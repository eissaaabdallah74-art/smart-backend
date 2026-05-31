/**
 * @deprecated Use src/services/ai/ai-orchestrator.service instead.
 * This service is kept for legacy compatibility but no longer uses Ollama.
 */
class AIService {
    constructor() {
        this.deprecated = true;
    }

    async askGeneric(prompt, contextData = '') {
        const AIOrchestrator = require('./ai/ai-orchestrator.service');
        // Simple mock user for legacy calls
        const mockUser = { id: 0, role: 'admin' }; 
        const result = await AIOrchestrator.ask(prompt, mockUser, contextData);
        return result.answer;
    }

    formatGenericList(title, items, fields = []) {
        if (!items || items.length === 0) return `لا توجد بيانات مسجلة لـ ${title}.\n`;

        let context = `--- ${title} ---\n`;
        items.forEach((item, idx) => {
            context += `رقم ${idx + 1}:\n`;
            if (fields.length > 0) {
                fields.forEach(f => {
                    context += `- ${f}: ${item[f] || 'غير محدد'}\n`;
                });
            } else {
                context += `- المعرف: ${item.id}\n`;
                context += `- الاسم: ${item.name || item.fullName || 'غير مسجل'}\n`;
            }
        });
        return context + "\n";
    }

    formatEmployeeContext(emp) {
        if (!emp) return "";
        return `بيانات الموظف ${emp.fullName}:
- المعرف (ID): ${emp.id}
- القسم: ${emp.employment?.department || 'غير محدد'}
- الوظيفة: ${emp.employment?.jobTitle || 'غير محدد'}
- الحالة: ${emp.employment?.isWorking ? 'على رأس العمل' : 'مستقيل/غير نشط'}
- الراتب: ${emp.payrollInsurance?.salaryGross || 'غير محدد'}\n\n`;
    }

    formatDriverContext(drv) {
        if (!drv) return "";
        return `بيانات السائق ${drv.name}:
- المعرف (ID): ${drv.id}
- الكود: ${drv.courierCode || 'غير مسجل'}
- العميل المرتبط: ${drv.clientName || 'غير محدد'}
- الحالة: ${drv.contractStatus || 'نشط'}\n\n`;
    }
}

module.exports = new AIService();
