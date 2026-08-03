import { ReactElement, useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useTheme } from '../stores';

interface LoadingScreenProps {
  onComplete: () => void;
  minDuration?: number; // Minimum time to show loading screen (ms)
}

export default function LoadingScreen({
  onComplete,
  minDuration = 1500,
}: LoadingScreenProps): ReactElement {
  const theme = useTheme((state) => state.theme);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Инициализиране...');

  useEffect(() => {
    const startTime = Date.now();

    // Simulate loading stages
    const stages = [
      { progress: 20, message: 'Зареждане на настройки...' },
      { progress: 40, message: 'Проверка на магазини...' },
      { progress: 60, message: 'Подготовка на интерфейса...' },
      { progress: 80, message: 'Финализиране...' },
      { progress: 100, message: 'Готово!' },
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      const stage = stages[currentStage];
      if (currentStage < stages.length && stage) {
        setProgress(stage.progress);
        setMessage(stage.message);
        currentStage++;
      }

      if (currentStage >= stages.length) {
        clearInterval(interval);

        // Ensure minimum duration has passed
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, minDuration - elapsed);

        setTimeout(() => {
          onComplete();
        }, remainingTime + 300); // Small delay after 100% for visual feedback
      }
    }, minDuration / (stages.length + 1));

    return () => clearInterval(interval);
  }, [minDuration, onComplete]);

  const isDark = theme === 'dark';

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-[9999] ${
      isDark ? 'bg-gray-900' : 'bg-white'
    }`}>
      <div className="text-center">
        {/* Logo / Icon */}
        <div className="mb-8">
          <div className={`w-24 h-24 mx-auto rounded-2xl flex items-center justify-center border ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-100 border-gray-200'
          }`}>
            <ShoppingBag className={`w-12 h-12 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        </div>

        {/* App Name */}
        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          StoreOS
        </h1>
        <p className={`mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Desktop Edition</p>

        {/* Progress Bar */}
        <div className="w-64 mx-auto mb-4">
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status Message */}
        <p className={`text-sm animate-pulse ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {message}
        </p>

        {/* Progress Percentage */}
        <p className={`text-xs mt-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          {progress}%
        </p>
      </div>
    </div>
  );
}
