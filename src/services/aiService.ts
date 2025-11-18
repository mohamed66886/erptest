import axios from 'axios';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export type AIServiceType = 'openai' | 'gemini' | 'copilot';

class AIService {
  private currentService: AIServiceType;
  private openaiKey: string;
  private geminiKey: string;

  constructor() {
    this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    this.geminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    
    // اختيار الخدمة المتاحة تلقائياً
    if (this.geminiKey) {
      this.currentService = 'gemini';
    } else if (this.openaiKey) {
      this.currentService = 'openai';
    } else {
      this.currentService = 'openai'; // افتراضي
    }

    // يمكن تجاوز الاختيار من متغير البيئة
    const envService = import.meta.env.VITE_AI_SERVICE as AIServiceType;
    if (envService && this.isServiceAvailable(envService)) {
      this.currentService = envService;
    }
  }

  private isServiceAvailable(service: AIServiceType): boolean {
    switch (service) {
      case 'openai':
        return !!this.openaiKey;
      case 'gemini':
        return !!this.geminiKey;
      case 'copilot':
        return false; // سيتم تطويره لاحقاً
      default:
        return false;
    }
  }

  // تغيير الخدمة المستخدمة
  switchService(service: AIServiceType): boolean {
    if (this.isServiceAvailable(service)) {
      this.currentService = service;
      return true;
    }
    return false;
  }

  getCurrentService(): AIServiceType {
    return this.currentService;
  }

  // الرسالة النظامية التي تحدد شخصية المساعد
  private getSystemMessage(): string {
    return `أنت مساعد ذكي متخصص في أنظمة ERP والمحاسبة. اسمك "مساعد ERP90".
      
      مهامك:
      - مساعدة المستخدمين في فهم واستخدام النظام المحاسبي
      - شرح كيفية إنشاء الفواتير وإدارة العملاء
      - توضيح التقارير المالية وكيفية قراءتها
      - مساعدة في إدارة المخازن والمنتجات
      - الإجابة على الاستفسارات المحاسبية والمالية
      
      قواعد المحادثة:
      - استخدم اللغة العربية في جميع الردود
      - كن مفيداً ومهذباً ومحترفاً
      - قدم إجابات واضحة ومفصلة
      - إذا لم تكن متأكداً من إجابة، اطلب توضيحات إضافية
      - ركز على الجوانب العملية والتطبيقية
      - استخدم أمثلة عملية عند الحاجة`;
  }

  // إرسال الرسالة باستخدام OpenAI
  private async sendToOpenAI(messages: { text: string; isUser: boolean }[]): Promise<AIResponse> {
    if (!this.openaiKey) {
      return {
        success: false,
        error: 'مفتاح OpenAI API غير محدد'
      };
    }

    try {
      const formattedMessages = [
        { role: 'system' as const, content: this.getSystemMessage() },
        ...messages.map(msg => ({
          role: msg.isUser ? 'user' as const : 'assistant' as const,
          content: msg.text
        }))
      ];

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: formattedMessages,
          max_tokens: 500,    // تقليل الطول للسرعة
          temperature: 0.7,
          stream: false       // تأكيد عدم استخدام streaming
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000  // تقليل timeout للسرعة
        }
      );

      if (response.data?.choices?.[0]?.message?.content) {
        return {
          success: true,
          message: response.data.choices[0].message.content.trim()
        };
      } else {
        return {
          success: false,
          error: 'لم يتم الحصول على رد صحيح من OpenAI'
        };
      }
    } catch (error) {
      console.error('OpenAI Error:', error);
      return this.handleAPIError(error);
    }
  }

  // إرسال الرسالة باستخدام Google Gemini
  private async sendToGemini(messages: { text: string; isUser: boolean }[]): Promise<AIResponse> {
    if (!this.geminiKey) {
      return {
        success: false,
        error: 'مفتاح Google Gemini API غير محدد'
      };
    }

    // قائمة النماذج للتجريب بالترتيب (الأسرع أولاً)
    const models = [
      'gemini-2.0-flash',  // الأسرع
      'gemini-pro',        // سريع ومضمون
      'gemini-2.5-pro'     // قوي لكن أبطأ
    ];

    // بناء المحادثة لـ Gemini بطريقة أبسط
    const lastUserMessage = messages.filter(msg => msg.isUser).pop();
    const userText = lastUserMessage?.text || 'مرحباً';
    const prompt = this.getSystemMessage() + '\n\nالمستخدم: ' + userText + '\nالمساعد: ';

    // جرب النموذج الأسرع أولاً فقط لتحسين الأداء
    const primaryModel = models[0]; // gemini-2.0-flash
    
    try {
      console.log(`� Gemini: استخدام ${primaryModel} للسرعة`);
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${this.geminiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,  // تقليل الطول للسرعة
            topK: 20,              // تقليل التنوع للسرعة
            topP: 0.8              // تحسين السرعة
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000  // تقليل timeout إلى 10 ثوانٍ فقط
        }
      );

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`✅ Gemini: نجح ${primaryModel} بسرعة`);
        return {
          success: true,
          message: response.data.candidates[0].content.parts[0].text.trim()
        };
      }
    } catch (error) {
      console.warn(`❌ Gemini: فشل ${primaryModel}, جرب البديل`);
      
      // جرب النموذج البديل إذا فشل الأول
      try {
        const fallbackModel = models[1]; // gemini-pro
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${this.geminiKey}`,
          {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 400,  // أقل حتى للبديل
              topK: 15,
              topP: 0.75
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 8000  // وقت أقل للبديل
          }
        );

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`✅ Gemini: نجح البديل ${fallbackModel}`);
          return {
            success: true,
            message: response.data.candidates[0].content.parts[0].text.trim()
          };
        }
      } catch (fallbackError) {
        console.warn('❌ Gemini: فشل البديل أيضاً');
      }
    }

    // إذا فشلت النماذج
    return {
      success: false,
      error: 'فشل في الاتصال بـ Gemini. يرجى المحاولة مرة أخرى'
    };
  }

  // معالجة أخطاء الـ API
  private handleAPIError(error: unknown): AIResponse {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      
      if (status === 400) {
        // خطأ في طلب Gemini
        const geminiError = data?.error?.message || '';
        if (geminiError.includes('not found') || geminiError.includes('not supported')) {
          return {
            success: false,
            error: 'النماذج الحديثة (Gemini 2.5/2.0) غير متاحة. يرجى المحاولة لاحقاً أو التحقق من إعدادات المفتاح'
          };
        }
        return {
          success: false,
          error: `خطأ في الطلب: ${geminiError}`
        };
      } else if (status === 401) {
        return {
          success: false,
          error: 'مفتاح API غير صحيح أو منتهي الصلاحية'
        };
      } else if (status === 403) {
        return {
          success: false,
          error: 'مفتاح API غير مخول للوصول لهذه الخدمة'
        };
      } else if (status === 429) {
        return {
          success: false,
          error: 'تم تجاوز حد الطلبات المسموح. يرجى المحاولة لاحقاً'
        };
      } else if (status === 503) {
        return {
          success: false,
          error: 'الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً'
        };
      } else {
        return {
          success: false,
          error: data?.error?.message || `خطأ في الخادم: ${status}`
        };
      }
    } else if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى'
      };
    } else {
      return {
        success: false,
        error: 'خطأ في الاتصال. يرجى التحقق من اتصال الإنترنت'
      };
    }
  }

  // إرسال الرسالة (الدالة الرئيسية)
  async sendMessage(messages: { text: string; isUser: boolean }[]): Promise<AIResponse> {
    switch (this.currentService) {
      case 'openai':
        return this.sendToOpenAI(messages);
      case 'gemini':
        return this.sendToGemini(messages);
      case 'copilot':
        return {
          success: false,
          error: 'دعم GitHub Copilot قيد التطوير'
        };
      default:
        return {
          success: false,
          error: 'خدمة AI غير مدعومة'
        };
    }
  }

  // فحص صحة الإعدادات
  isConfigured(): boolean {
    return this.isServiceAvailable(this.currentService);
  }

  // الحصول على الخدمات المتاحة
  getAvailableServices(): AIServiceType[] {
    const services: AIServiceType[] = [];
    if (this.isServiceAvailable('openai')) services.push('openai');
    if (this.isServiceAvailable('gemini')) services.push('gemini');
    return services;
  }

  // الحصول على معلومات الخدمة
  getServiceInfo() {
    const availableServices = this.getAvailableServices();
    
    return {
      current: this.currentService,
      available: availableServices,
      configured: this.isConfigured(),
      details: {
        openai: {
          name: 'OpenAI GPT',
          model: 'GPT-3.5 Turbo',
          available: this.isServiceAvailable('openai')
        },
        gemini: {
          name: 'Google Gemini',
          model: 'Gemini 2.0 Flash (سريع)',
          available: this.isServiceAvailable('gemini')
        },
        copilot: {
          name: 'GitHub Copilot',
          model: 'قيد التطوير',
          available: false
        }
      }
    };
  }

}

// إنشاء instance واحد من الخدمة
export const aiService = new AIService();
