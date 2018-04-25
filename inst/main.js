"use babel";

import { CompositeDisposable } from "atom"; // eslint-disable-line import/no-unresolved
import RIndent from "./r-indent";

export default {
    config: {
        hangingIndentTabs: {
            type: "number",
            default: 1,
            description: "Number of tabs used for _hanging_ indents",
            enum: [
                1,
                2,
            ],
        },
    },
    activate: () => {
        this.rIndent = new RIndent();
        this.subscriptions = new CompositeDisposable();
        this.subscriptions.add(atom.commands.add("atom-text-editor:not(.mini)",
            { "editor:newline": () => this.rIndent.properlyIndent() }));
    },
};
