const GeminiProvider = require('./gemini.provider');
const AIContextBuilder = require('./ai-context-builder.service');
const courierTools = require('./tools/courier-ai.tools');
const companyTools = require('./tools/company-ai.tools');
const reportsTools = require('./tools/reports-ai.tools');
const globalSearchTools = require('./tools/global-search-ai.tools');

class AIOrchestrator {
    constructor() {
        this.primaryProvider = 'gemini';
        
        // Circuit Breaker State (Gemini Only)
        this.circuitBreaker = {
            gemini: {
                failures: 0,
                lastFailureAt: null,
                status: 'CLOSED', // CLOSED, OPEN
                openUntil: null
            }
        };
        
        // Stats
        this.stats = {
            lastSuccessfulModel: null,
            lastErrorAt: null,
            lastErrorCode: null,
            recentGeminiFailures: 0
        };
    }

    async ask(message, user, legacyContext = '') {
        const startTime = Date.now();
        let status = 'SUCCESS';
        let errorMessage = null;
        let fallbackUsed = false;
        let fallbackReason = null;
        let actualModel = GeminiProvider.primaryModel;
        let retryCount = 0;

        // 0. Check Circuit Breaker
        if (this.isCircuitOpen()) {
            return this.returnUnavailableResponse('gemini_circuit_open', startTime, user, message);
        }

        try {
            // 1. Context Building
            const query = message.toLowerCase();
            let context = legacyContext || await AIContextBuilder.buildGlobalContext(query, user);

            // National ID Detection (14 digits)
            const nidMatch = message.match(/(?:^|[^0-9])([0-9]{14})(?![0-9])/);
            const nationalId = nidMatch ? nidMatch[1] : null;

            // 2. Tool Execution
            let toolUsed = null;
            try {
            
            // Check Permissions
            const allowedRoles = ['admin', 'hr', 'operations_manager', 'operations'];
            const hasCourierPermission = allowedRoles.includes(user.role);

            if (query.includes('سائق') || query.includes('مندوب') || query.includes('courier') || query.includes('driver') || /\b\d{14}\b/.test(query)) {
                if (!hasCourierPermission) {
                    return {
                        answer: "عذراً، ليس لديك صلاحية للوصول إلى بيانات المندوبين.",
                        requestedProvider: 'gemini',
                        actualProvider: 'gemini',
                        model: GeminiProvider.primaryModel
                    };
                }

                // National ID Detection - High priority
                const hasNidKeywords = query.includes('بطاق') || query.includes('قومي') || query.includes('national') || query.includes('nid');

                if (nationalId && (hasNidKeywords || query.length < 60)) {
                    const profile = await courierTools.getCourierByNationalId(nationalId, user);
                    if (profile && profile.error) {
                        return {
                            answer: "حصل خطأ أثناء البحث في قاعدة البيانات. حاول مرة أخرى بعد قليل.",
                            requestedProvider: 'gemini',
                            actualProvider: null,
                            status: 'FAILED'
                        };
                    }
                    if (profile) {
                        toolUsed = 'getCourierByNationalId';
                        context += AIContextBuilder.formatToolResult('بيانات المندوب من واقع الرقم القومي', profile);
                    }
                } else {
                    const idMatch = query.match(/(سائق|مندوب|driver|courier)\D*(\d+)/);
                    if (idMatch && idMatch[2]) {
                        const courierId = parseInt(idMatch[2]);
                        if (query.includes('حضور') || query.includes('غياب') || query.includes('attendance')) {
                            const attendance = await courierTools.getCourierAttendanceSummary(courierId, null, user);
                            if (attendance && !attendance.error) {
                                toolUsed = 'getCourierAttendanceSummary';
                                context += AIContextBuilder.formatToolResult('سجل حضور المندوب', attendance);
                            }
                        } else if (query.includes('راتب') || query.includes('قبض') || query.includes('payroll') || query.includes('salary')) {
                            const payroll = await courierTools.getCourierPayrollHistory(courierId, user);
                            if (payroll && !payroll.error) {
                                toolUsed = 'getCourierPayrollHistory';
                                context += AIContextBuilder.formatToolResult('سجل رواتب المندوب', payroll);
                            }
                        } else {
                            const profile = await courierTools.getCourier360Profile(courierId, user);
                            if (profile && profile.error) {
                                return {
                                    answer: "حصل خطأ أثناء البحث في قاعدة البيانات. حاول مرة أخرى بعد قليل.",
                                    requestedProvider: 'gemini',
                                    actualProvider: null,
                                    status: 'FAILED'
                                };
                            }
                            if (profile) {
                                toolUsed = 'getCourier360Profile';
                                context += AIContextBuilder.formatToolResult('الملف الشخصي للمندوب', profile);
                            }
                        }
                    } else if (query.includes('بحث') || query.includes('دور') || query.includes('search') || query.includes('فين')) {
                        toolUsed = 'searchCouriers';
                        const searchResult = await courierTools.searchCouriers({ q: message }, user);
                        if (searchResult && searchResult.error) {
                            return {
                                answer: "حصل خطأ أثناء البحث في قاعدة البيانات. حاول مرة أخرى بعد قليل.",
                                requestedProvider: 'gemini',
                                actualProvider: null,
                                status: 'FAILED'
                            };
                        }
                        context += AIContextBuilder.formatToolResult('نتائج البحث عن المندوبين', searchResult);
                    }
                }
            }
            if (query.includes('عميل') || query.includes('شركة') || query.includes('client') || query.includes('company')) {
                const idMatch = query.match(/(شركة|عميل|company|client)\D*(\d+)/);
                if (idMatch && idMatch[2]) {
                    const companyId = parseInt(idMatch[2]);
                    if (query.includes('حساب') || query.includes('مالية') || query.includes('billing')) {
                        toolUsed = 'getCompanyBillingSummary';
                        const billing = await companyTools.getCompanyBillingSummary(companyId, null, user);
                        context += AIContextBuilder.formatToolResult('بيانات المحاسبة للشركة', billing);
                    } else {
                        toolUsed = 'getCompanyOverview';
                        const overview = await companyTools.getCompanyOverview(companyId, user);
                        context += AIContextBuilder.formatToolResult('نظرة عامة على الشركة', overview);
                    }
                } else {
                    toolUsed = 'getCompanyOverview';
                    const overview = await companyTools.getCompanyOverview(null, user);
                    context += AIContextBuilder.formatToolResult('قائمة العملاء/الشركات', overview);
                }
            }
            if (query.includes('تقرير') || query.includes('ملخص') || query.includes('report') || query.includes('summary')) {
                if (query.includes('مالي') || query.includes('فلوس') || query.includes('finance')) {
                    toolUsed = 'generateFinanceReport';
                    const report = await reportsTools.generateFinanceReport({}, user);
                    context += AIContextBuilder.formatToolResult('التقرير المالي', report);
                } else if (query.includes('تشغيل') || query.includes('عمليات') || query.includes('operations')) {
                    toolUsed = 'generateOperationsReport';
                    const report = await reportsTools.generateOperationsReport({}, user);
                    context += AIContextBuilder.formatToolResult('تقرير التشغيل', report);
                }
            }

                // Global Search Fallback or Direct Intent
                const isWhoIsQuery = query.includes('مين') || query.includes('من صاحب') || query.includes('صاحب الرقم') || query.includes('صاحب الموبايل') || query.includes('من هو');
                const hasSearchKeywords = query.includes('بحث') || query.includes('ابحث') || query.includes('search') || query.includes('find');
                const hasIdentifier = nationalId || query.match(/^01[0125]\d{8}$/) || query.match(/\b\d+\b/);

                if (!toolUsed && (isWhoIsQuery || hasSearchKeywords || (hasIdentifier && query.length < 50))) {
                    let hint = null;
                    if (query.includes('سائق') || query.includes('مندوب')) hint = 'Driver';
                    else if (query.includes('موظف')) hint = 'Employee';
                    else if (query.includes('عميل')) hint = 'Client';
                    else if (query.includes('متقدم') || query.includes('مقابلة')) hint = 'Interview';

                    // Extract identifier
                    let identifier = nationalId;
                    if (!identifier) {
                        const phoneMatch = query.match(/01[0125]\d{8}/);
                        if (phoneMatch) identifier = phoneMatch[0];
                    }
                    if (!identifier) {
                        const idMatch = query.match(/\d+/);
                        if (idMatch) identifier = idMatch[0];
                    }
                    if (!identifier) {
                        // Better name extraction: look for common prefixes
                        const namePrefixes = ['عن', 'عن اسم', 'على', 'على اسم', 'مين', 'صاحب'];
                        let cleanedQuery = query;
                        namePrefixes.forEach(p => {
                            if (cleanedQuery.includes(p + ' ')) {
                                cleanedQuery = cleanedQuery.split(p + ' ').slice(1).join(p + ' ');
                            }
                        });
                        identifier = cleanedQuery.trim();
                    }

                    if (identifier && identifier.length > 1) {
                        toolUsed = 'globalSearch';
                        const searchResults = await globalSearchTools.globalSearch(identifier, hint, user);
                        if (searchResults && searchResults.error) {
                            return {
                                answer: "حصل خطأ أثناء البحث في قاعدة البيانات. حاول مرة أخرى بعد قليل.",
                                requestedProvider: 'gemini',
                                actualProvider: null,
                                status: 'FAILED'
                            };
                        }
                        context += AIContextBuilder.formatToolResult('نتائج البحث الشامل في السجلات', searchResults);
                    }
                }
            } catch (err) {
                console.error(`[AI Orchestrator Tool Error] ${err.message}`, err);
                // Continue without tool context if tool fails
            }

            // 3. Provider Call (Primary Model)
            let result = await GeminiProvider.generateResponse(message, context, GeminiProvider.primaryModel);
            
            // 4. Handle Primary Model Failure -> Try Fallback Model
            if (result.error) {
                const isQuotaError = result.errorCode === 429 || result.isQuotaExceeded;
                
                if (isQuotaError) {
                    await this.logUsage({
                        user,
                        provider: 'gemini',
                        requestedProvider: 'gemini',
                        actualProvider: null,
                        model: result.model,
                        prompt: message,
                        response: '',
                        startTime,
                        status: 'FAILED',
                        errorMessage: result.error,
                        fallbackUsed: false,
                        fallbackReason: 'gemini_quota_exceeded'
                    });
                    return {
                        answer: "تم الوصول للحد المسموح مؤقتاً لخدمة الذكاء الاصطناعي، حاول مرة أخرى بعد قليل.",
                        requestedProvider: 'gemini',
                        actualProvider: null,
                        model: result.model,
                        status: 'FAILED'
                    };
                }

                console.log(`[Gemini Fallback] Primary model failed, trying fallback model: ${GeminiProvider.fallbackModel}`);
                fallbackUsed = true;
                fallbackReason = 'gemini_primary_model_failed';
                actualModel = GeminiProvider.fallbackModel;
                
                result = await GeminiProvider.generateResponse(message, context, GeminiProvider.fallbackModel);
                
                if (result.error) {
                    if (result.errorCode === 429 || result.isQuotaExceeded) {
                        return {
                            answer: "تم الوصول للحد المسموح مؤقتاً لخدمة الذكاء الاصطناعي، حاول مرة أخرى بعد قليل.",
                            requestedProvider: 'gemini',
                            actualProvider: null,
                            model: result.model,
                            status: 'FAILED'
                        };
                    }
                    this.recordGeminiFailure(result.error);
                    return this.returnUnavailableResponse('gemini_unavailable', startTime, user, message, result.error);
                }
            }

            // Record Success
            this.stats.lastSuccessfulModel = result.model;
            this.circuitBreaker.gemini.failures = 0;
            retryCount = result.retryCount;

            // 5. Logging
            await this.logUsage({
                user,
                provider: 'gemini',
                requestedProvider: 'gemini',
                actualProvider: 'gemini',
                model: result.model,
                prompt: message,
                response: result.text,
                startTime,
                status: 'SUCCESS',
                toolName: toolUsed,
                fallbackUsed,
                fallbackReason,
                retryCount
            });

            return {
                answer: result.text,
                requestedProvider: 'gemini',
                actualProvider: 'gemini',
                model: result.model,
                fallbackUsed,
                fallbackReason
            };
        } catch (error) {
            this.recordGeminiFailure(error.message);
            await this.logUsage({
                user,
                provider: 'gemini',
                requestedProvider: 'gemini',
                actualProvider: null,
                prompt: message,
                response: '',
                startTime,
                status: 'FAILED',
                errorMessage: error.message,
                fallbackUsed,
                fallbackReason: 'exception'
            });
            return this.returnUnavailableResponse('gemini_exception', startTime, user, message, error.message);
        }
    }

    isCircuitOpen() {
        const now = Date.now();
        if (this.circuitBreaker.gemini.status === 'OPEN') {
            if (now > this.circuitBreaker.gemini.openUntil) {
                console.log('[Circuit Breaker] Resetting Gemini circuit to CLOSED');
                this.circuitBreaker.gemini.status = 'CLOSED';
                this.circuitBreaker.gemini.failures = 0;
                return false;
            }
            return true;
        }
        return false;
    }

    recordGeminiFailure(errorMsg) {
        this.circuitBreaker.gemini.failures++;
        this.circuitBreaker.gemini.lastFailureAt = new Date();
        this.stats.recentGeminiFailures++;
        this.stats.lastErrorAt = new Date();
        this.stats.lastErrorCode = errorMsg?.substring(0, 50);
        
        if (this.circuitBreaker.gemini.failures >= 3) {
            console.warn('[Circuit Breaker] Gemini reached limit. Opening circuit for 2 minutes.');
            this.circuitBreaker.gemini.status = 'OPEN';
            this.circuitBreaker.gemini.openUntil = Date.now() + (2 * 60 * 1000);
        }
    }

    returnUnavailableResponse(reason, startTime, user, message, error = null) {
        const answer = "عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة لاحقاً.";
        this.logUsage({
            user,
            provider: 'gemini',
            requestedProvider: 'gemini',
            actualProvider: null,
            prompt: message,
            response: answer,
            startTime,
            status: 'FAILED',
            errorMessage: error || reason,
            fallbackUsed: false,
            fallbackReason: reason
        });
        return {
            success: false,
            answer,
            reply: answer,
            response: answer,
            requestedProvider: 'gemini',
            actualProvider: null,
            fallbackUsed: false,
            fallbackReason: reason
        };
    }

    async logUsage({ user, provider, requestedProvider, actualProvider, model, prompt, response, startTime, status, errorMessage, toolName, fallbackUsed, fallbackReason, retryCount = 0 }) {
        try {
            const { AIUsageLog } = require('../../models');
            await AIUsageLog.create({
                authUserId: user.id,
                employeeId: user.employeeId,
                provider: provider,
                requestedProvider,
                actualProvider,
                model: model || 'unknown',
                toolName,
                promptPreview: prompt.substring(0, 2000),
                responsePreview: response.substring(0, 1000),
                status,
                fallbackUsed,
                fallbackReason,
                retryCount,
                latencyMs: Date.now() - startTime,
                errorMessage: errorMessage?.substring(0, 500)
            });
        } catch (e) {
            console.warn('Failed to log AI usage:', e.message);
        }
    }

    getHealth() {
        return {
            configuredProvider: 'gemini',
            geminiConfigured: GeminiProvider.isAvailable(),
            geminiPrimaryModel: GeminiProvider.primaryModel,
            geminiFallbackModel: GeminiProvider.fallbackModel,
            circuitBreaker: {
                status: this.circuitBreaker.gemini.status,
                failures: this.circuitBreaker.gemini.failures,
                openUntil: this.circuitBreaker.gemini.openUntil ? new Date(this.circuitBreaker.gemini.openUntil) : null
            },
            stats: this.stats
        };
    }
}

module.exports = new AIOrchestrator();
