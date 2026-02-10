export interface User {
    id: string;
    email: string;
    name: string;
}

export interface HeaderColumns {
    id: string; // unique key, e.g. "permitNumber"
    type?: "number" | "text" | "datetime"; // optional category for styling/icon
    icon?: string; // optional icon src (e.g. hash, calendar)
}

export type CategoryType = "categorical" | "numerical" | "spatial" | "temporal";
export interface Category {
    id: CategoryType;
    label: string;
}

export const DataType = Object.freeze({
    number: "Number",
    integer: "Integer",
    float: "Float",
    text: "Text",
    string: "String",
    boolean: "Boolean",
    datetime: "DateTime",
    real: "Real",
});

export interface Column {
    attribute: string;
    type: string;
}

export interface Row {
    [key: string]: string | number;
}
export interface TableData {
    name: string;
    column: Column[];
    row: Row[];
}

export interface DataSource {
    id: string;

    name: string;
    description: string;

    format: string;
    size: number;

    category: string;

    relevance: string;
    modalities: string;

    datacount: number;
    source: string; // user_uploaded, web_scraped, api_fetched
    license: string;

    downloadURL: string;
    viewURL: string;
    originalURL?: string;

    createdAt: string;
    updatedAt: string;

    columns: Column[];
}

export type UserDatabase = {
    type: "user";
    id: string;
    datasources: DataSource;
};

export interface WebDatabase {
    type: "web";
    id: string;
    websiteType: string; // e.g., "government", "research_institution"
    websiteName: string;
    websiteURL: string;
    datasources: DataSource;
}

export type Database = UserDatabase | WebDatabase;

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}
export interface ChatArchive {
    name: string;
    chat_id: string;
}

export const headerColumns: HeaderColumns[] = [
    { id: "permitNumber", type: "number" },
    { id: "accountNumber", type: "number" },
    { id: "siteNumber", type: "number" },
    { id: "legalName", type: "text" },
    { id: "issuedDate", type: "datetime" },
];

export const categories: Category[] = [
    { id: "categorical", label: "Categorical" },
    { id: "numerical", label: "Numerical" },
    { id: "spatial", label: "Spatial" },
    { id: "temporal", label: "Temporal" },
];

export interface QueryExecResult {
    columns: string[];
    values: any[][];
}
