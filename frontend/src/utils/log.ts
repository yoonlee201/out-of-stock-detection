type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

class BrowserLogger {
    private isDevelopment: boolean;

    constructor() {
        this.isDevelopment = import.meta.env.MODE === "development";
    }

    private write(level: LogLevel, ...args: any[]): void {
        // Only log in development mode
        if (!this.isDevelopment) {
            return;
        }

        // Log to console in development mode
        const consoleMethod = console[level.toLowerCase() as "info" | "warn" | "error" | "debug"] || console.log;
        consoleMethod(...args);
    }

    public log(...args: any[]): void {
        this.write("INFO", ...args);
    }

    public info(...args: any[]): void {
        this.write("INFO", ...args);
    }

    public warn(...args: any[]): void {
        this.write("WARN", ...args);
    }

    public error(...args: any[]): void {
        this.write("ERROR", ...args);
    }

    public debug(...args: any[]): void {
        this.write("DEBUG", ...args);
    }
}

// Create a default logger instance
const logger = new BrowserLogger();

export default logger;
export { BrowserLogger };
export type { LogLevel };
