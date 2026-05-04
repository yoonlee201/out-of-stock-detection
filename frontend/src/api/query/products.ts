import { axiosAuth } from "..";

export const apiExportProductsCSV = async () => {
    const { data } = await axiosAuth.get("/products/export/csv", { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
};
