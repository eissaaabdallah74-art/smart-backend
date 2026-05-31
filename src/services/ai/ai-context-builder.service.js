const { Driver, Client, Employee, AttendanceMonthlySummary, FinanceTransaction, Task } = require('../../models');
const AIDataRedactor = require('./ai-data-redactor.service');

/**
 * Service to build the context string from various data sources.
 * It uses AI tools to fetch and format data.
 */
class AIContextBuilder {
    static async buildGlobalContext(query, user) {
        let context = `إحصائيات عامة للنظام:\n`;
        try {
            const [empCount, drvCount, cliCount] = await Promise.all([
                Employee.count(),
                Driver.count(),
                Client.count()
            ]);
            context += `- عدد الموظفين: ${empCount}\n`;
            context += `- عدد السائقين (Couriers): ${drvCount}\n`;
            context += `- عدد العملاء: ${cliCount}\n\n`;
        } catch (e) {
            context += `(تعذر تحميل الإحصائيات العامة)\n`;
        }

        return context;
    }

    static formatToolResult(title, data) {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            return `--- ${title} ---\nلا توجد بيانات متاحة.\n\n`;
        }
        let jsonStr = JSON.stringify(data, null, 2);
        if (jsonStr.length > 10000) {
            jsonStr = jsonStr.substring(0, 10000) + "\n... (Truncated due to size)";
        }
        return `--- ${title} ---\n${jsonStr}\n\n`;
    }
}

module.exports = AIContextBuilder;
