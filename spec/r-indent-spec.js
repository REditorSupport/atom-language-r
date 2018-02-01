"use babel";
import RIndent from "../lib/r-indent";
describe("r-indent", () => {
    const FILE_NAME = "fixtures/test_file.R";
    let buffer = null;
    let editor = null;
    let rIndent = null;

    beforeEach(() => {
        waitsForPromise(() =>
            atom.workspace.open(FILE_NAME).then((ed) => {
                editor = ed;
                editor.setSoftTabs(true);
                editor.setTabLength(2);
                buffer = editor.buffer;
            })
        );

        waitsForPromise(() => {
            const packages = atom.packages.getAvailablePackageNames();
            let languagePackage;

            if (packages.indexOf("language-r") > -1) {
                languagePackage = "language-r";
            } else if (packages.indexOf("language-python") > -1) {
                languagePackage = "language-python";
            } else if (packages.indexOf("MagicPython") > -1) {
                languagePackage = "MagicPython";
            }

            return atom.packages.activatePackage(languagePackage);
        });

        waitsForPromise(() =>
            atom.packages.activatePackage("r-indent").then(() => {
                rIndent = new RIndent();
            })
        );
    });

    describe("package", () =>
        it("loads R file and package", () => {
            expect(editor.getPath()).toContain(FILE_NAME);
            expect(atom.packages.isPackageActive("r-indent")).toBe(true);
        })
    );

    // Aligned with opening delimiter
    describe("aligned with opening delimiter", () => {
        describe("when indenting after newline", () => {
            /*
            f <- function(param_a, param_b, param_c,
                             param_d):
                    pass
            */

            it("indents after open def params", () => {
                editor.insertText("f <- function(param_a, param_b, param_c,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(14));
            });

            /*
            x <- c(0, 1, 2,
                   3, 4, 5)
            */
            it("indents after open bracket with multiple values on the first line", () => {
                editor.insertText("x <- c(0, 1, 2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(7));
            });

            /*
            x <- c(0,
                   1)
            */
            it("indents after open bracket with one value on the first line", () => {
                editor.insertText("x <- c(0,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(7));
            });

            /*
            x <- function(a, b, c, c(3, 4, 5,
                                     6, 7, 8)
                          )
            */
            it("indeents in nested lists when inner list is on the same line", () => {
                editor.insertText("x <- function(a, b, c, c(3, 4, 5,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(25));
            });

            it("indents back to opening delimiter after nested args", () => {
                editor.insertText("x <- function(a, b, c, c(3, 4, 5,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(25));

                editor.insertText("6, 7, 8)\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(14));
            });
            /*
            s = "[ will this \"break ( the parsing?"
            */
            it("does not indent with delimiters that are quoted", () => {
                editor.insertText("s = \"[ will this \\\"break ( the parsing?\"\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe("");
            });
            /*
            x = ["here(\"(", "is", "a",
                     "list", "of", ["nested]",
                                    "strings\\"],
                     r"some \[\"[of which are raw",
                     "and some of which are not"]
            */
            it("knows when to indent when some delimiters are literal, and some are not", () => {
                editor.insertText("x = [\"here(\\\"(\", \"is\", \"a\",\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(5));

                editor.insertText("\"list\", \"of\", [\"nested]\",\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(20));

                editor.insertText("\"strings\\\\\"],\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(3)).toBe(" ".repeat(5));

                editor.insertText("r\"some \\[\\\"[of which are raw\",\n");
                editor.autoIndentSelectedRows(4);
                expect(buffer.lineForRow(4)).toBe(" ".repeat(5));
            });

            it("indents normally after function definition", () => {
                editor.insertText("f <- function(param_a, param_b, param_c){\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(2));
            });

            /*
            f <- function(param_a, param_b, param_c,
                     param_d){
                    pass
            */
            it("indents normally long args in function definition", () => {
                editor.insertText("f <- function(param_a, param_b, param_c,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(14));

                editor.insertText("param_d){\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(2));
            });

            /*
            f <- function(param_a,
                          param_b,
                          param_c){}
                    pass
            */
            it("keeps indentation on succeding open lines", () => {
                editor.insertText("def test(param_a,\n");
                rIndent.properlyIndent();
                editor.insertText("param_b,\n");
                editor.autoIndentSelectedRows(2);
                expect(buffer.lineForRow(2)).toBe(" ".repeat(9));
            });

            /*
            class TheClass(object):
                    def test(param_a, param_b,
                             param_c):
                        a_list = [1, 2, 3,
                                  4]
            */
            it("allows for fluid indent in multi-level situations", () => {
                editor.insertText("class TheClass(object):\n");
                editor.autoIndentSelectedRows(1);
                editor.insertText("def test(param_a, param_b,\n");
                rIndent.properlyIndent();
                editor.insertText("param_c):\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(3)).toBe(" ".repeat(8));

                editor.insertText("a_list = [1, 2, 3,\n");
                rIndent.properlyIndent();
                editor.insertText("4]\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(5)).toBe(" ".repeat(8));
            });

            /*
            def f(arg1, arg2, arg3,
                  arg4, arg5, arg6=")\)",
                  arg7=0):
                return 0
            */
            it("indents properly when delimiters are an argument default string", () => {
                editor.insertText("def f(arg1, arg2, arg3,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(6));

                editor.insertText("arg4, arg5, arg6=\")\\)\",\n");
                editor.autoIndentSelectedRows(2);
                expect(buffer.lineForRow(2)).toBe(" ".repeat(6));

                editor.insertText("arg7=0):\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(3)).toBe(" ".repeat(4));
            });

            /*
            for i in range(10):
                    for j in range(20):
                            def f(x=[0,1,2,
                                     3,4,5]):
                                return x * i * j
            */
            it("indents properly when blocks and lists are deeply nested", () => {
                editor.insertText("for i in range(10):\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(4));

                editor.insertText("for j in range(20):\n");
                editor.autoIndentSelectedRows(2);
                expect(buffer.lineForRow(2)).toBe(" ".repeat(8));

                editor.insertText("def f(x=[0,1,2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(3)).toBe(" ".repeat(17));

                editor.insertText("3,4,5]):\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(4)).toBe(" ".repeat(12));
            });

            /*
            """ quote with a single string delimiter: " """
            var_name = [0, 1, 2,
            */
            it("handles odd number of string delimiters inside triple quoted string", () => {
                editor.insertText("\"\"\" quote with a single string delimiter: \" \"\"\"\n");
                editor.insertText("var_name = [0, 1, 2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(12));
            });

            /*
            """ here is a triple quote with a two string delimiters: "" """
            var_name = [0, 1, 2,
            */
            it("handles even number of string delimiters inside triple quoted string", () => {
                editor.insertText("\"\"\" a quote with a two string delimiters: \"\" \"\"\"\n");
                editor.insertText("var_name = [0, 1, 2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(12));
            });

            /*
            ### here is "a triple quote" with three extra" string delimiters" ###
            var_name = [0, 1, 2,
            */
            it("handles three string delimiters spaced out inside triple quoted string", () => {
                editor.insertText("### here is \"a quote\" with extra\" string delimiters\" ###\n");
                editor.insertText("var_name = [0, 1, 2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(12));
            });

            /*
            ### string with an \\"escaped delimiter in the middle###
            var_name = [0, 1, 2,;
            */
            it("correctly handles escaped delimieters at the end of a triple quoted string", () => {
                editor.insertText("### string with an \\\"escaped delimiter in the middle###\n");
                editor.insertText("var_name = [0, 1, 2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(12));
            });

            /*
            ### here is a string with an escaped delimiter ending\\###"
            var_name = [0, 1, 2,;
            */
            it("correctly handles escaped delimiters at the end of a quoted string", () => {
                editor.insertText("### here is a string with an escaped delimiter ending\\###\"\n");
                editor.insertText("var_name = [0, 1, 2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(12));
            });
        });

        describe("when unindenting after newline :: aligned with opening delimiter", () => {
            /*
            def test(param_a,
                     param_b):
                pass
            */
            it("unindents after close def params", () => {
                editor.insertText("def test(param_a,\n");
                rIndent.properlyIndent();
                editor.insertText("param_b):\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(4));
            });

            /*
            tup = (True, False,
                   False)
            */
            it("unindents after close tuple", () => {
                editor.insertText("tup = (True, False,\n");
                rIndent.properlyIndent();
                editor.insertText("False)\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe("");
            });

            /*
            a_list = [1, 2,
                      3]
            */
            it("unindents after close bracket", () => {
                editor.insertText("a_list = [1, 2,\n");
                rIndent.properlyIndent();
                editor.insertText("3]\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe("");
            });

            /*
            a_dict = {0: 0}
            */
            it("unindents after close curly brace", () => {
                editor.insertText("a_dict = {0: 0}\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe("");
            });
        });
    });

    // Hanging
    describe("hanging", () => {
        describe("when indenting after newline", () => {
            /*
            def test(
                param_a
            )
            */
            it("hanging indents after open def params", () => {
                editor.insertText("def test(\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(4));
            });

            /*
            tup = (
                "elem"
            )
            */
            it("indents after open tuple", () => {
                editor.insertText("tup = (\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(4));
            });

            /*
            a_list = [
                "elem"
            ]
            */
            it("indents after open bracket", () => {
                editor.insertText("a_list = [\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(4));
            });

            /*
            def test(
                param_a,
                param_b,
                param_c
            )
            */
            it("indents on succeding open lines", () => {
                editor.insertText("def test(\n");
                rIndent.properlyIndent();
                editor.insertText("param_a,\n");
                editor.autoIndentSelectedRows(2);
                editor.insertText("param_b,\n");
                editor.autoIndentSelectedRows(3);
                expect(buffer.lineForRow(3)).toBe(" ".repeat(4));
            });

            /*
            class TheClass(object):
                def test(
                        param_a, param_b,
                        param_c):
                            a_list = [
                                "1", "2", "3",
                                "4"
                            ]
            */
            it("allows for indent in multi-level situations", () => {
                editor.insertText("class TheClass(object):\n");
                editor.autoIndentSelectedRows(1);
                editor.insertText("def test(\n");
                rIndent.properlyIndent();
                editor.insertText("param_a, param_b,\n");
                editor.autoIndentSelectedRows(3);
                editor.insertText("param_c):\n");
                editor.autoIndentSelectedRows(4);
                expect(buffer.lineForRow(4)).toBe(" ".repeat(4));

                editor.insertText("a_list = [\n");
                rIndent.properlyIndent();
                editor.insertText("\"1\", \"2\", \"3\",\n");
                editor.autoIndentSelectedRows(6);
                editor.insertText("\"4\"]\n");
                editor.autoIndentSelectedRows(7);
                expect(buffer.lineForRow(7)).toBe(" ".repeat(4));
            });
        });

        describe("when newline is in a comment", () => {
            /*
            x = [    #
                0
            ]
            */
            it("indents when delimiter is not commented, but other characters are", () => {
                editor.insertText("x = [ #\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe(" ".repeat(4));
            });

            /*
             * [
             */
            it("does not indent when bracket delimiter is commented", () => {
                editor.insertText("# [\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe("");
            });

            /*
             * (
             */
            it("does not indent when parentheses delimiter is commented", () => {
                editor.insertText("# (\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe("");
            });

            /*
             * {
             */
            it("does not indent when brace delimiter is commented", () => {
                editor.insertText("# {\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe("");
            });

            /*
             * def f():
             */
            it("does not indent when function def is commented", () => {
                editor.insertText("# def f():\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(1)).toBe("");
            });
        });

        describe("when continuing a hanging indent after opening/closing bracket(s)", () => {
            /*
            alpha = (
                epsilon(),
                gamma
            )
            */
            it("continues correctly after bracket is opened and closed on same line", () => {
                editor.insertText("alpha = (\n");
                rIndent.properlyIndent();
                editor.insertText("epsilon(),\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(4));
            });

            /*
            alpha = (
                    epsilon(arg1, arg2,
                            arg3, arg4),
                    gamma
            )
            */
            it("continues after bracket is opened/closed on different lines", () => {
                editor.insertText("alpha = (\n");
                rIndent.properlyIndent();

                editor.insertText("epsilon(arg1, arg2,\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(2)).toBe(" ".repeat(12));

                editor.insertText("arg3, arg4),\n");
                rIndent.properlyIndent();
                expect(buffer.lineForRow(3)).toBe(" ".repeat(4));
            });
        });
    });

    describe("when source is malformed", () =>

        /*
        class DoesBadlyFormedCodeBreak )
        */
        it("does not throw error or indent when code is malformed", () => {
            editor.insertText("class DoesBadlyFormedCodeBreak )\n");
            expect(() => rIndent.properlyIndent())
            .not.toThrow();
            expect(buffer.lineForRow(1)).toBe("");
        })
    );
});