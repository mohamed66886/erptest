import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Bot, Send, X, Minimize2, Maximize2, Sparkles, AlertCircle, Wifi, WifiOff, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { aiService } from '../services/aiService';
import AISettings from './AISettings';
import './ai-assistant.css';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const AIAssistantFloat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: aiService.isConfigured() 
        ? `مرحباً! أنا مساعدك الذكي للنظام المحاسبي. أستخدم ${aiService.getServiceInfo().details[aiService.getCurrentService()].name} لمساعدتك. كيف يمكنني مساعدتك اليوم؟`
        : 'مرحباً! لاستخدام المساعد الذكي، يرجى إضافة مفتاح Gemini (مجاني) أو OpenAI API في ملف .env',
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');
  const [lastError, setLastError] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // التحقق من إعدادات الـ AI
    if (!aiService.isConfigured()) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'يرجى إعداد مفتاح Gemini (مجاني) أو OpenAI API في ملف .env لاستخدام المساعد الذكي.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setConnectionStatus('error');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsTyping(true);
    setConnectionStatus('connected');
    setLastError('');

    try {
      // إرسال المحادثة الكاملة للـ AI
      const conversationHistory = [...messages, userMessage].map(msg => ({
        text: msg.text,
        isUser: msg.isUser
      }));

      const response = await aiService.sendMessage(conversationHistory);

      if (response.success && response.message) {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: response.message,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setConnectionStatus('connected');
      } else {
        // في حالة فشل الـ AI، استخدم الرد المحلي كبديل
        const currentServiceName = aiService.getServiceInfo().details[aiService.getCurrentService()].name;
        const availableServices = aiService.getAvailableServices();
        const alternativeService = availableServices.find(s => s !== aiService.getCurrentService());
        
        let errorText = `⚠️ خطأ في ${currentServiceName}: ${response.error}\n\n`;
        
        if (alternativeService) {
          const altServiceName = aiService.getServiceInfo().details[alternativeService].name;
          errorText += `💡 نصيحة: يمكنك التبديل إلى ${altServiceName} في الإعدادات\n\n`;
        } else {
          errorText += `💡 نصيحة: تأكد من صحة مفتاح API أو جرب خدمة أخرى\n\n`;
        }
        
        errorText += `📋 إجابة محلية: ${getAIResponse(currentInput)}`;

        const fallbackResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: errorText,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackResponse]);
        setConnectionStatus('error');
        setLastError(response.error || 'خطأ غير معروف');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'عذراً، حدث خطأ في الاتصال. سأحاول مساعدتك بالمعلومات المحلية: ' + getAIResponse(currentInput),
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
      setConnectionStatus('error');
      setLastError('خطأ في الاتصال');
    } finally {
      setIsTyping(false);
    }
  };

  const getAIResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('فاتورة') || message.includes('invoice')) {
      return 'يمكنك إنشاء فاتورة جديدة من خلال الذهاب إلى قسم "المبيعات" ثم "إضافة فاتورة". أو يمكنك البحث عن الفواتير الموجودة من قسم "التقارير".';
    } else if (message.includes('تقرير') || message.includes('report')) {
      return 'التقارير متاحة في القائمة الجانبية. يمكنك الوصول إلى تقارير المبيعات اليومية، تقارير الأرباح، تقارير المخزون، وغيرها من التقارير المفصلة.';
    } else if (message.includes('عميل') || message.includes('customer')) {
      return 'لإدارة العملاء، توجه إلى قسم "العملاء" حيث يمكنك إضافة عملاء جدد، تعديل بيانات العملاء، أو عرض سجل التعاملات مع كل عميل.';
    } else if (message.includes('مخزن') || message.includes('warehouse')) {
      return 'إدارة المخازن متاحة من قسم "المخازن" حيث يمكنك متابعة الكميات، إضافة أصناف جديدة، وإدارة حركة البضائع.';
    } else if (message.includes('مرحبا') || message.includes('السلام')) {
      return 'أهلاً وسهلاً! أنا هنا لمساعدتك في استخدام النظام المحاسبي. ما الذي تريد معرفته؟';
    } else if (message.includes('مساعدة') || message.includes('help')) {
      return 'يمكنني مساعدتك في:\n• إنشاء وإدارة الفواتير\n• عرض التقارير المالية\n• إدارة العملاء والموردين\n• متابعة المخزون\n• شرح كيفية استخدام الميزات المختلفة\n\nما الذي تحتاج مساعدة فيه تحديداً؟';
    } else {
      return 'شكراً لسؤالك! يمكنني مساعدتك في استخدام النظام المحاسبي. هل يمكنك توضيح ما تريد معرفته أكثر؟ مثلاً: الفواتير، التقارير، العملاء، أو المخزون.';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ar-EG', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <>
      {/* زر الذكاء الاصطناعي العائم */}
      {!isOpen && (
        <div 
          className="fixed bottom-6 left-6 group ai-float-container" 
          style={{ zIndex: 999999, pointerEvents: 'auto' }}
        >
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }}
            className="h-16 w-16 rounded-full ai-gradient shadow-xl hover:shadow-2xl transition-all duration-300 ai-button relative overflow-hidden"
            size="lg"
            style={{ 
              pointerEvents: 'auto', 
              zIndex: 999999,
              position: 'relative'
            }}
          >
            {/* تأثير البريق */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:animate-pulse group-hover:translate-x-full transition-transform duration-1000"></div>
            
            {/* أيقونة الذكاء الاصطناعي */}
            <div className="relative flex items-center justify-center">
              <Bot className="h-7 w-7 text-white group-hover:scale-110 transition-transform duration-200" />
              <Sparkles className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </Button>
          
          {/* حلقات النبض */}
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30"></div>
          <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-20" style={{ animationDelay: '0.5s' }}></div>
          
          {/* تلميح تفاعلي */}
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              مساعد ذكي محاسبي
            </div>
            {/* سهم صغير للأسفل */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}

      {/* نافذة المحادثة */}
      {isOpen && (
        <div 
            className={`fixed bottom-6 left-6 bg-white rounded-xl shadow-2xl border transition-all duration-300 chat-window ${
              isMinimized ? 'w-80 h-16' : 'w-96 h-[520px]'
            }`} 
            style={{ 
              zIndex: 99999,
              pointerEvents: 'auto'
            }}
          >
          {/* شريط العنوان */}
          <div 
            className="flex items-center justify-between p-4 border-b ai-gradient text-white rounded-t-xl relative overflow-hidden" 
            style={{ 
              pointerEvents: 'auto',
              zIndex: 100000
            }}
          >
            {/* تأثير الخلفية المتحركة */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-indigo-600/20 animate-pulse"></div>
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                <Bot className="h-5 w-5 text-white" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">مساعد ERP90 الذكي</h3>
                  {aiService.isConfigured() ? (
                    <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-300" />
                  )}
                </div>
                <p className="text-xs text-white/80 flex items-center gap-1">
                  {connectionStatus === 'connected' && aiService.isConfigured() && (
                    <>
                      <Wifi className="h-3 w-3 text-green-400" />
                      <span>متصل بـ {aiService.getServiceInfo().details[aiService.getCurrentService()].name}</span>
                    </>
                  )}
                  {connectionStatus === 'error' && (
                    <>
                      <WifiOff className="h-3 w-3 text-red-400" />
                      <span>وضع محلي</span>
                    </>
                  )}
                  {!aiService.isConfigured() && (
                    <>
                      <AlertCircle className="h-3 w-3 text-yellow-400" />
                      <span>يتطلب إعداد API</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 chat-header-buttons">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSettings(true);
                }}
                className="text-white hover:bg-blue-500/20 h-8 w-8 p-0"
                style={{ 
                  pointerEvents: 'auto', 
                  zIndex: 100001, 
                  position: 'relative'
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                className="text-white hover:bg-blue-500/20 h-8 w-8 p-0"
                style={{ 
                  pointerEvents: 'auto', 
                  zIndex: 100001, 
                  position: 'relative'
                }}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-white hover:bg-blue-500/20 h-8 w-8 p-0"
                style={{ 
                  pointerEvents: 'auto', 
                  zIndex: 100001, 
                  position: 'relative'
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* المحادثة */}
          {!isMinimized && (
            <>
              <div className="flex-1 p-4 h-[380px] overflow-y-auto bg-gray-50">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} message-enter`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 message-bubble shadow-sm ${
                          message.isUser
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-sm user-message'
                            : 'bg-white text-gray-800 rounded-bl-sm border ai-message hover:shadow-md transition-shadow duration-200'
                        }`}
                      >
                        {!message.isUser && (
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-600">مساعد ERP90</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-line leading-relaxed">{message.text}</p>
                        <p className={`text-xs mt-2 ${
                          message.isUser ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* مؤشر الكتابة */}
                  {isTyping && (
                    <div className="flex justify-start message-enter">
                      <div className="bg-white text-gray-800 rounded-2xl rounded-bl-sm border px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-blue-600" />
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full typing-dot"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full typing-dot"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full typing-dot"></div>
                          </div>
                          <span className="text-xs text-gray-500">يكتب...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* حقل الإدخال */}
              <div className="p-4 border-t bg-gradient-to-r from-gray-50 to-gray-100 rounded-b-xl">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="اسأل عن أي شيء في النظام المحاسبي..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ai-input transition-all duration-200 bg-white shadow-sm"
                      dir="rtl"
                    />
                    {inputMessage && (
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <Sparkles className="h-4 w-4 text-blue-400 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className={`h-12 w-12 p-0 rounded-xl shadow-md transition-all duration-200 ${
                      inputMessage.trim() && !isTyping 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-105' 
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                
                {/* معلومات الحالة والاقتراحات */}
                {messages.length === 1 && (
                  <div className="mt-3 space-y-2">
                    {/* معلومات الحالة */}
                    <div className="text-xs text-gray-600 flex items-center gap-2">
                      {aiService.isConfigured() ? (
                        <>
                          <Sparkles className="h-3 w-3 text-green-500" />
                          <span>مدعوم بـ {aiService.getServiceInfo().details[aiService.getCurrentService()].name}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                          <span>أضف مفتاح Gemini (مجاني) أو OpenAI للذكاء الاصطناعي الحقيقي</span>
                        </>
                      )}
                    </div>
                    
                    {/* اقتراحات سريعة */}
                    <div className="flex flex-wrap gap-2">
                      {['كيف أنشئ فاتورة؟', 'عرض التقارير', 'إدارة العملاء'].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setInputMessage(suggestion)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors duration-200 border border-blue-200"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* نافذة الإعدادات */}
      <AISettings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  );
};

export default AIAssistantFloat;
