"use babel";
export default class RIndent {
    properlyIndent() {
        this.editor = atom.workspace.getActiveTextEditor();
        if (!atom.workspace.isTextEditor(this.editor)) {
            return;
        }
        const language = this.editor.getGrammar().scopeName.substring(0, 13);

        // Make sure this is a Python file
        if (language !== "source.r" && language !== "text.md" && language !== "source.python") {
            return;
        }

        // Get base variables
        const row = this.editor.getCursorBufferPosition().row;
        const col = this.editor.getCursorBufferPosition().column;

        // Parse the entire file up to the current point, keeping track of brackets
        let lines = this.editor.getTextInBufferRange([[0, 0], [row, col]]).split("\n");


        // At this point, the newline character has just been added,
        // so remove the last element of lines, which will be the empty line
        lines = lines.splice(0, lines.length - 1);
        const parseOutput = this.parseLines(lines);

        // openBracketStack: A stack of [row, col] pairs describing where open brackets are
        // lastClosedRow: Either empty, or an array [rowOpen, rowClose] describing the rows
        //  here the last bracket to be closed was opened and closed.
        // shouldHang: A stack containing the row number where each bracket was closed.
        // lastColonRow: The last row a def/for/if/elif/else/try/except etc. block started
        const { openBracketStack, lastClosedRow, shouldHang, lastColonRow } = parseOutput;

        // always indent if line ends with assignment
        const indentforassignment = this.endsWithAssignment(lines[row - 1]);

        if (indentforassignment) {
            const indentLevel = this.editor.indentationForBufferRow(row - 1) + 1;
            this.editor.setIndentationForBufferRow(row, indentLevel);
            return;
        }

        if (shouldHang || indentforassignment) {
            this.indentHanging(row, this.editor.buffer.lineForRow(row - 1));
            return;
        }
        // if we haven't started any parenthesis yet
        if (!(openBracketStack.length || (lastClosedRow.length && openBracketStack))) {
            let previousline = "";
            let indentLevel = 0;
            const previouslinenumber = row - 1;
            if (previouslinenumber > 0) {
                previousline = lines[previouslinenumber];
                const previousindent = this.editor.indentationForBufferRow(row - 1);
                const indentLevel = this.indentBinary(lines[row - 1], previousline, previousindent);

            }  else {
                const previousindent = false;
                let indentLevel = 0;
            }

            //
            //
            // }


            this.editor.setIndentationForBufferRow(row, indentLevel);
            this.editor.setIndentationForBufferRow(row, indentLevel);

            return;
        }
        // we've had parenthesis, but they're all closed
        if (!openBracketStack.length) {
            // Can assume lastClosedRow is not empty
            if (lastClosedRow[1] === row - 1) {
                // We just closed a bracket on the row, get indentation from the
                // row where it was opened
                let indentLevel = this.editor.indentationForBufferRow(lastClosedRow[0]);
                const currentline = lines[lastClosedRow[1]];
                let previousclosedline = "";
                const previousclosedlinenumber = lastClosedRow[0] - 1;
                if (previousclosedlinenumber > -1) {
                    previousclosedline = lines[lastClosedRow[0] - 1];
                }
                indentLevel = this.indentBinary(currentline, previousclosedline, indentLevel);

                if (lastColonRow === row - 1) {
                    // We just finished def/for/if/elif/else/try/except etc. block,
                    // need to increase indent level by 1.
                    indentLevel += 1;
                }
                this.editor.setIndentationForBufferRow(row, indentLevel);
                if (indentLevel >= 2 && lastColonRow === row - 1) {
                    const nextrow = row + 1;
                    this.editor.setIndentationForBufferRow(nextrow, indentLevel - 1);
                }
            } else {
                let previousline = "";
                const previouslinenumber = row - 1;
                if (previouslinenumber > 0) {
                    previousline = lines[previouslinenumber];
                    const previousindent = this.editor.indentationForBufferRow(row - 1);
                    const indentLevel = this.indentBinary(lines[row - 1], previousline, previousindent);
                    this.editor.setIndentationForBufferRow(row, indentLevel);
                } else {
                    previousline = "";
                    const previousindent = false;
                    const indentLevel = 0;
                    this.editor.setIndentationForBufferRow(row, indentLevel);
                }

            }
            return;
        }
        // Get tab length for context
        const tabLength = this.editor.getTabLength();

        const lastOpenBracketLocations = openBracketStack.pop();

        // Get some booleans to help work through the cases

        // haveClosedBracket is true if we have ever closed a bracket
        const haveClosedBracket = lastClosedRow.length;
        // justOpenedBracket is true if we opened a bracket on the row we just finished
        const justOpenedBracket = lastOpenBracketLocations[0] === row - 1;
        // justClosedBracket is true if we closed a bracket on the row we just finished
        const justClosedBracket = haveClosedBracket && lastClosedRow[1] === row - 1;
        // closedBracketOpenedAfterLineWithCurrentOpen is an ***extremely*** long name, and
        // it is true if the most recently closed bracket pair was opened on
        // a line AFTER the line where the current open bracket
        const closedBracketOpenedAfterLineWithCurrentOpen = haveClosedBracket &&
            lastClosedRow[0] > lastOpenBracketLocations[0];
        let indentColumn;
        if (!justOpenedBracket && !justClosedBracket) {
            // The bracket was opened before the previous line,
            // and we did not close a bracket on the previous line.
            // Thus, nothing has happened that could have changed the
            // indentation level since the previous line, so
            // we should use whatever indent we are given.
            return;
        } else if (justClosedBracket && closedBracketOpenedAfterLineWithCurrentOpen) {
            // A bracket that was opened after the most recent open
            // bracket was closed on the line we just finished typing.
            // We should use whatever indent was used on the row
            // where we opened the bracket we just closed. This needs
            // to be handled as a separate case from the last case below
            // in case the current bracket is using a hanging indent.
            // This handles cases such as
            // x = [0, 1, 2,
            //      [3, 4, 5,
            //       6, 7, 8],
            //      9, 10, 11]
            // which would be correctly handled by the case below, but it also correctly handles
            // x = [
            //     0, 1, 2, [3, 4, 5,
            //               6, 7, 8],
            //     9, 10, 11
            // ]
            // which the last case below would incorrectly indent an extra space
            // before the "9", because it would try to match it up with the
            // open bracket instead of using the hanging indent.
            const previousIndent = this.editor.indentationForBufferRow(lastClosedRow[0]);
            indentColumn = previousIndent * tabLength;
        } else {
            // lastOpenBracketLocations[1] is the column where the bracket was,
            // so need to bump up the indentation by one
            if (lastColonRow === lastClosedRow[1]) {
                const indentationRow = lastClosedRow[0];
                let indentLevel = this.editor.indentationForBufferRow(indentationRow);
                indentLevel += 1;
                this.editor.setIndentationForBufferRow(row, indentLevel);
                const nextrow = row + 1;
                this.editor.setIndentationForBufferRow(nextrow, indentLevel - 1);
                return;
            }
            indentColumn = lastOpenBracketLocations[1] + 1;
        }

        // Calculate soft-tabs from spaces (can have remainder)
        let tabs = indentColumn / tabLength;
        const rem = (tabs - Math.floor(tabs)) * tabLength;

        // If there's a remainder, `@editor.buildIndentString` requires the tab to
        // be set past the desired indentation level, thus the ceiling.
        tabs = rem > 0 ? Math.ceil(tabs) : tabs;

        // Offset is the number of spaces to subtract from the soft-tabs if they
        // are past the desired indentation (not divisible by tab length).
        const offset = rem > 0 ? tabLength - rem : 0;

        // I'm glad Atom has an optional `column` param to subtract spaces from
        // soft-tabs, though I don't see it used anywhere in the core.
        // It looks like for hard tabs, the "tabs" input can be fractional and
        // the "column" input is ignored...?
        const indent = this.editor.buildIndentString(tabs, offset);

        // The range of text to replace with our indent
        // will need to change this for hard tabs, especially tricky for when
        // hard tabs have mixture of tabs + spaces, which they can judging from
        // the editor.buildIndentString function
        const startRange = [row, 0];
        const stopRange = [row, this.editor.indentationForBufferRow(row) * tabLength];
        this.editor.getBuffer().setTextInRange([startRange, stopRange], indent);
    }

    containsPlus(line) {
        let hasPlus = false;
        const c = line[line.length - 1];
        if (c === "+") {
            hasPlus = true;
        }
        return hasPlus;
    }

    endsWithAssignment(line) {
        let endswithassignment = false;
        if(line !== undefined){
          if (line.endsWith("<-")) {
              endswithassignment = true;
          }
        } else {
          line = "";
        }

        return endswithassignment;
    }

    containsPipe(line) {
        let hasPipe = false;
        if (line.endsWith("%>%") || line.endsWith("%$%") ||
        line.endsWith("%T>%") || line.endsWith("%<>%")) {
            hasPipe = true;
        }
        return hasPipe;
    }

    indentPlus(currentfunctionline, previousfunctionline) {
        let indentforplus = false;
        const plusatline = this.containsPlus(currentfunctionline);
        if (previousfunctionline.length > 1) {
            const plusaboveline = this.containsPlus(previousfunctionline);
            const assignmentaboveline = this.endsWithAssignment(previousfunctionline);
            if (plusatline && !plusaboveline && !assignmentaboveline) {
                indentforplus = true;
            }
        } else {
            if (plusatline) {
                indentforplus = true;
            }
        }
        return indentforplus;
    }

    deindentPlus(currentfunctionline, previousfunctionline) {
        let deindentforplus = false;
        const plusatline = this.containsPlus(currentfunctionline);
        if (previousfunctionline.length > 1) {
            const plusaboveline = this.containsPlus(previousfunctionline);
            if (!plusatline && plusaboveline) {
                deindentforplus = true;
            }
        }
        return deindentforplus;
    }

    indentPipe(currentfunctionline, previousfunctionline) {
        let indentforpipe = false;
        const pipeatline = this.containsPipe(currentfunctionline);
        if (previousfunctionline.length > 1) {
            const pipeaboveline = this.containsPipe(previousfunctionline);
            const assignmentaboveline = this.endsWithAssignment(previousfunctionline);
            if (pipeatline && !pipeaboveline && !assignmentaboveline) {
                indentforpipe = true;
            }
        } else {
            if (pipeatline) {
                indentforpipe = true;
            }
        }
        return indentforpipe;
    }

    deindentPipe(currentfunctionline, previousfunctionline) {
        let deindentforpipe = false;
        const pipeatline = this.containsPipe(currentfunctionline);
        if (previousfunctionline.length > 1) {
            const pipeaboveline = this.containsPipe(previousfunctionline);
            if (!pipeatline && pipeaboveline) {
                deindentforpipe = true;
            }
        }
        return deindentforpipe;
    }

    indentBinary(currentline, previousclosedline, currentIndentLevel) {
        const indentforplus = this.indentPlus(currentline, previousclosedline);
        const deindentforplus = this.deindentPlus(currentline, previousclosedline);
        const indentforpipe = this.indentPipe(currentline, previousclosedline);
        const deindentforpipe = this.deindentPipe(currentline, previousclosedline);
        let newindentlevel = currentIndentLevel;
        if (indentforplus || indentforpipe) {
            newindentlevel += 1;
        }
        if (deindentforplus || deindentforpipe) {
            newindentlevel -= 1;
        }
        return newindentlevel;
    }

    parseLines(lines) {
        // openBracketStack is an array of [row, col] indicating the location
        // of the opening bracket (square, curly, or parentheses)
        const openBracketStack = [];
        // lastClosedRow is either empty or [rowOpen, rowClose] describing the
        // rows where the latest closed bracket was opened and closed.
        let lastClosedRow = [];
        // If we are in a string, this tells us what character introduced the string
        // i.e., did this string start with ' or with "?
        let stringDelimiter = [];
        // This is the row of the last function definition
        let lastColonRow = NaN;

        // true if we are in a triple quoted string
        let inTripleQuotedString = false;

        // If we have seen two of the same string delimiters in a row,
        // then we have to check the next character to see if it matches
        // in order to correctly parse triple quoted strings.
        let checkNextCharForString = false;

        // keep track of the number of consecutive string delimiter's we've seen
        // used to tell if we are in a triple quoted string
        let numConsecutiveStringDelimiters = 0;

        // true if we should have a hanging indent, false otherwise
        let shouldHang = false;
        // NOTE: this parsing will only be correct if the python code is well-formed
        // statements like "[0, (1, 2])" might break the parsing
        // loop over each line
        for (const row of Array(lines.length).fill().map((_, i) => i)) {
            const line = lines[row];


            // boolean, whether or not the current character is being escaped
            // applicable when we are currently in a string
            let isEscaped = false;

            // This is the last defined def/for/if/elif/else/try/except row
            const lastlastColonRow = lastColonRow;

            for (const col of Array(line.length).fill().map((_, i) => i)) {
                const c = line[col];

                if (c === stringDelimiter && !isEscaped) {
                    numConsecutiveStringDelimiters += 1;
                } else if (checkNextCharForString) {
                    numConsecutiveStringDelimiters = 0;
                    stringDelimiter = [];
                } else {
                    numConsecutiveStringDelimiters = 0;
                }

                checkNextCharForString = false;

                // If stringDelimiter is set, then we are in a string
                // Note that this works correctly even for triple quoted strings
                if (stringDelimiter.length) {
                    if (isEscaped) {
                        // If current character is escaped, then we do not care what it was,
                        // but since it is impossible for the next character to be escaped as well,
                        // go ahead and set that to false
                        isEscaped = false;
                    } else {
                        if (c === stringDelimiter) {
                            // We are seeing the same quote that started the string, i.e. ' or "
                            if (inTripleQuotedString) {
                                if (numConsecutiveStringDelimiters === 3) {
                                    // Breaking out of the triple quoted string...
                                    numConsecutiveStringDelimiters = 0;
                                    stringDelimiter = [];
                                    inTripleQuotedString = false;
                                }
                            } else if (numConsecutiveStringDelimiters === 3) {
                                // reset the count, correctly handles cases like ''''''
                                numConsecutiveStringDelimiters = 0;
                                inTripleQuotedString = true;
                            } else if (numConsecutiveStringDelimiters === 2) {
                                // We are not currently in a triple quoted string, and we've
                                // seen two of the same string delimiter in a row. This could
                                // either be an empty string, i.e. '' or "", or it could be
                                // the start of a triple quoted string. We will check the next
                                // character, and if it matches then we know we're in a triple
                                // quoted string, and if it does not match we know we're not
                                // in a string any more (i.e. it was the empty string).
                                checkNextCharForString = true;
                            } else if (numConsecutiveStringDelimiters === 1) {
                                // We are not in a string that is not triple quoted, and we've
                                // just seen an un-escaped instance of that string delimiter.
                                // In other words, we've left the string.
                                // It is also worth noting that it is impossible for
                                // numConsecutiveStringDelimiters to be 0 at this point, so
                                // this set of if/else if statements covers all cases.
                                stringDelimiter = [];
                            }
                        } else if (c === "\\") {
                            // We are seeing an unescaped backslash, the next character is escaped.
                            // Note that this is not exactly true in raw strings, HOWEVER, in raw
                            // strings you can still escape the quote mark by using a backslash.
                            // Since that's all we really care about as far as escaped characters
                            // go, we can assume we are now escaping the next character.
                            isEscaped = true;
                        }
                    }
                } else {
                    if ("[(".includes(c)) {
                        openBracketStack.push([row, col]);
                        // If the only characters after this opening bracket are whitespace,
                        // then we should do a hanging indent. If there are other non-whitespace
                        // characters after this, then they will set the shouldHang boolean to false
                        shouldHang = true;
                    } else if (" \t\r\n".includes(c)) { // just in case there's a new line
                        // If it's whitespace, we don't care at all
                        // this check is necessary so we don't set shouldHang to false even if
                        // someone e.g. just entered a space between the opening bracket and the
                        // newline.
                        continue;
                    } else if (c === "#") {
                        // This check goes as well to make sure we don't set shouldHang
                        // to false in similar circumstances as described in the whitespace section.
                        break;
                    } else {
                        // We've already skipped if the character was white-space, an opening
                        // bracket, or a new line, so that means the current character is not
                        // whitespace and not an opening bracket, so shouldHang needs to get set to
                        // false.
                        shouldHang = false;

                        // Similar to above, we've already skipped all irrelevant characters,
                        // so if we saw a colon earlier in this line, then we would have
                        // incorrectly thought it was the end of a def/for/if/elif/else/try/except
                        // block when it was actually a dictionary being defined, reset the
                        // lastColonRow variable to whatever it was when we started parsing this
                        // line.
                        lastColonRow = lastlastColonRow;

                        // if (c === "{")
                        if ("{".includes(c)) {
                            lastColonRow = row;
                        } else if (")]".includes(c) && openBracketStack.length) {
                            // The .pop() will take the element off of the openBracketStack as it
                            // adds it to the array for lastClosedRow.
                            lastClosedRow = [openBracketStack.pop()[0], row];
                        } else if ("'\"".includes(c)) {
                            // Starting a string, keep track of what quote was used to start it.
                            stringDelimiter = c;
                            numConsecutiveStringDelimiters += 1;
                        }
                    }
                }
            }
        }
        return { openBracketStack, lastClosedRow, shouldHang, lastColonRow };
    }

    indentHanging(row) {
        // Indent at the current block level plus the setting amount (1 or 2)
        const indent = (this.editor.indentationForBufferRow(row)) +
            (atom.config.get("python-indent.hangingIndentTabs"));

        // Set the indent
        this.editor.setIndentationForBufferRow(row, indent);
    }
}
