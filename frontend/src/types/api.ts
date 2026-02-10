import type { Column } from "./db";

interface ApiDatasourcesResponse {
    id: string;
    name: string;
    description: string;

    format: string;
    size: number;

    category: string;

    relevance: string;
    modalities: string;

    datacount: number;
    source: string;
    license: string;

    download_url: string;
    view_url: string;
    original_url?: string;

    created_at: string;
    updated_at: string;

    columns: Column[];
}
export interface ApiUserDatabaseResponse {
    id: string;
    datasources: ApiDatasourcesResponse;
}

export interface ApiWebDatabaseResponse {
    id: string;
    website_type: string;
    website_name: string;
    website_url: string;
    datasources: ApiDatasourcesResponse;
}
