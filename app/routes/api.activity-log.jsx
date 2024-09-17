export const action = async ({ request }) => {
    const { existsSync, mkdirSync, writeFileSync } = await import("fs");
    
    const requestData = await request.json();
    const logDir = requestData.logDir;
    const filePath = requestData.filePath;
    const logData = requestData.logData;
    try {
        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true }, (error) => {
                if (error) {
                    throw new Error(error);
                }
            });
        }
        writeFileSync(filePath, logData + '\n', { encoding: "utf-8", flag: 'a' }, (err) => {
            if (err) {
                throw new Error(err);
            }
        });

        return {
            response: "success",
            data: [],
        };
    } catch (error) {
        return {
            response: "error",
            data: error,
        };
    }
};