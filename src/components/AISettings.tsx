import React, { useState } from 'react';
import { Settings, Key, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { aiService, AIServiceType } from '../services/aiService';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const AISettings: React.FC<AISettingsProps> = ({ isOpen, onClose }) => {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const serviceInfo = aiService.getServiceInfo();

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const response = await aiService.sendMessage([
        { text: 'مرحبا', isUser: true }
      ]);

      setConnectionResult({
        success: response.success,
        message: response.success 
          ? 'تم الاتصال بنجاح!' 
          : response.error || 'فشل في الاتصال'
      });
    } catch (error) {
      setConnectionResult({
        success: false,
        message: 'خطأ في اختبار الاتصال'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">إعدادات الذكاء الاصطناعي</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* معلومات الخدمات المتاحة */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">الخدمات المتاحة</h4>
            <div className="space-y-2">
              {Object.entries(serviceInfo.details).map(([key, service]) => (
                <div 
                  key={key} 
                  className={`p-3 rounded border text-sm ${
                    serviceInfo.current === key 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{service.name}</span>
                    <div className="flex items-center gap-1">
                      {service.available ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {serviceInfo.current === key && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          حالي
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    النموذج: {service.model}
                  </div>
                  {service.available && serviceInfo.current !== key && (
                    <button
                      onClick={() => {
                        aiService.switchService(key as AIServiceType);
                        window.location.reload(); // إعادة تحميل الصفحة لتطبيق التغيير
                      }}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 hover:bg-blue-200 transition-colors"
                    >
                      التبديل إلى هذه الخدمة
                    </button>
                  )}
                  {key === 'gemini' && !service.available && (
                    <div className="text-xs text-orange-600 mt-1">
                      احصل على مفتاح مجاني من Google AI Studio
                    </div>
                  )}
                  {key === 'openai' && !service.available && (
                    <div className="text-xs text-orange-600 mt-1">
                      احصل على مفتاح من OpenAI Platform (مدفوع)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* إعدادات API */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Key className="h-4 w-4" />
              إعداد مفاتيح API
            </h4>
            {serviceInfo.configured ? (
              <div className="bg-green-50 border border-green-200 p-3 rounded text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  تم تكوين {serviceInfo.details[serviceInfo.current].name} بنجاح
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded text-sm space-y-3">
                <div className="text-orange-700 font-medium">
                  🎯 للبدء السريع (مجاناً):
                </div>
                
                {/* إعداد Gemini */}
                <div className="bg-white p-2 rounded border">
                  <div className="font-medium text-green-700 mb-1">
                    1️⃣ Google Gemini (مُوصى به - مجاني)
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
                    <li>اذهب إلى: ai.google.dev</li>
                    <li>سجل دخول بحساب Google</li>
                    <li>أنشئ API Key مجاني</li>
                    <li>أضف في .env: VITE_GEMINI_API_KEY=your_key</li>
                  </ol>
                </div>

                {/* إعداد OpenAI */}
                <div className="bg-white p-2 rounded border">
                  <div className="font-medium text-blue-700 mb-1">
                    2️⃣ OpenAI (قوي لكن مدفوع)
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
                    <li>اذهب إلى: platform.openai.com</li>
                    <li>أضف بطاقة ائتمان</li>
                    <li>أنشئ API Key</li>
                    <li>أضف في .env: VITE_OPENAI_API_KEY=your_key</li>
                  </ol>
                </div>

                <div className="text-xs text-orange-600">
                  ⚡ بعد إضافة المفتاح، أعد تشغيل التطبيق
                </div>
              </div>
            )}
          </div>

          {/* اختبار الاتصال */}
          {serviceInfo.configured && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">اختبار الاتصال</h4>
              <Button
                onClick={testConnection}
                disabled={testingConnection}
                className="w-full"
                size="sm"
              >
                {testingConnection ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    جاري الاختبار...
                  </>
                ) : (
                  'اختبار الاتصال'
                )}
              </Button>

              {connectionResult && (
                <div className={`p-3 rounded text-sm ${
                  connectionResult.success 
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {connectionResult.message}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <Button onClick={onClose} className="w-full">
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AISettings;
