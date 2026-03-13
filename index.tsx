
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-red-500">
            <h2 className="text-2xl font-bold text-red-600 mb-4">عذراً، حدث خطأ غير متوقع</h2>
            <p className="text-gray-600 mb-6">يرجى تحديث الصفحة أو المحاولة مرة أخرى لاحقاً.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              تحديث الصفحة
            </button>
            {this.state.error && (
              <div className="mt-4 p-4 bg-gray-100 rounded text-left overflow-auto text-xs text-gray-800 max-h-40" dir="ltr">
                {this.state.error.toString()}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
