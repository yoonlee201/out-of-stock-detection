import { axiosAuth } from "..";

export const initiateGoogleLogin = async () => {
    const response = await axiosAuth.get("/auth/google/login");
    // Redirect to Google OAuth
    window.location.href = response.data.authorization_url;
};

export const checkGoogleDriveStatus = async () => {
    const response = await axiosAuth.get("/auth/google/status");
    return response.data;
};

export const disconnectGoogleDrive = async () => {
    const response = await axiosAuth.post("/auth/google/disconnect");
    return response.data;
};

export const listDriveFiles = async (folderId?: string) => {
    const response = await axiosAuth.get("/drive/files", {
        params: { folder_id: folderId },
    });
    return response.data.files;
};

export const uploadToDrive = async (fileList: File[]) => {
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
        formData.append("files", fileList[i]);
    }

    const response = await axiosAuth.post("/drive/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};

// export const createDriveFolder = async (name: string, parentId?: string) => {
//     const response = await axiosAuth.post('/drive/folders', {
//         name,
//         parent_id: parentId
//     });
//     return response.data;
// };

export const deleteDriveFile = async (fileId: string) => {
    const response = await axiosAuth.delete(`/drive/files/${fileId}`);
    return response.data;
};
