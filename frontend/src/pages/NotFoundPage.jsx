import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Sparkles } from 'lucide-react';
import Button from '../components/common/Button';

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-5 font-black text-2xl">
          404
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
          Page Not Found
        </h1>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          The requested restroom, page, or portal endpoint does not exist or has been relocated.
        </p>
        <Link to="/">
          <Button variant="primary" size="md" leftIcon={Home} fullWidth>
            Return to Homepage
          </Button>
        </Link>
      </div>
    </div>
  );
}
