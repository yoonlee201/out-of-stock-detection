export const Role = { user: "user", system: "system" };

export interface ChatMessage {
    role: (typeof Role)[keyof typeof Role];
    content: string;
}

export const TabsOverview = Object.freeze({
    gptSuggestions: "GPT Suggestions",
    myDatabase: "My Databases",
    openSource: "Open Source",
    upload: "Upload",
});

export const AttributeType = Object.freeze({
    int: "Integer",
    text: "Text",
    float: "Float",
    char: "Character",
    boolean: "Boolean",
    real: "Real",
});

export const TabsDetail = Object.freeze({
    metadata: "Metadata",
    chat: "Chat History",
    output: "Output",
    tables: "Tables",
});

export type SQLiteType = "INTEGER" | "TEXT" | "REAL";
