import React, { useState, useEffect } from 'react';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Square,
  Building2,
  Calendar,
  CreditCard,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ownerApi from '../../api/owner.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { extractErrorMessage } from '../../utils/errors';
import { useToast } from '../../hooks/useToast';

export default function TokenVerificationModal({ isOpen, onClose, onSessionUpdated }) {
  const { success, error: showErrorToast, info } = useToast();

  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Active Session state
  const [activeSession, setActiveSession] = useState(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isSessionActionLoading, setIsSessionActionLoading] = useState(false);

  // Live timer for active session
  useEffect(() => {
    let interval = null;
    if (activeSession && activeSession.status === 'ACTIVE') {
      interval = setInterval(() => {
        setSessionSeconds((sec) => sec + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession]);

  const handleTokenChange = (e) => {
    let val = e.target.value.toUpperCase();
    if (val && !val.startsWith('SG-') && !val.startsWith('S') && !val.startsWith('SG')) {
      val = `SG-${val}`;
    }
    setTokenInput(val);
    setErrorMessage(null);
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!tokenInput.trim()) {
      showErrorToast('Please enter an SG booking token.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setVerificationResult(null);

    try {
      const res = await ownerApi.verifyBookingToken(tokenInput.trim());
      const data = res?.data || res;
      setVerificationResult(data);
      success('Booking token verified! Customer is eligible for entry.');
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      showErrorToast(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStartSession = async () => {
    if (!tokenInput.trim()) return;
    setIsSessionActionLoading(true);

    try {
      const res = await ownerApi.startSession(tokenInput.trim());
      const data = res?.data || res;
      setActiveSession(data?.session || data);
      setSessionSeconds(0);
      success('Usage session started! Gate turnstile unlocked.');
      onSessionUpdated?.();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    } finally {
      setIsSessionActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession?.id) return;
    setIsSessionActionLoading(true);

    try {
      await ownerApi.endSession(activeSession.id);
      success(
        `Session concluded! Duration: ${Math.floor(sessionSeconds / 60)}m ${sessionSeconds % 60}s`
      );
      setActiveSession(null);
      setVerificationResult(null);
      setTokenInput('');
      onSessionUpdated?.();
    } catch (err) {
      showErrorToast(extractErrorMessage(err));
    } finally {
      setIsSessionActionLoading(false);
    }
  };

  const handleReset = () => {
    setTokenInput('');
    setVerificationResult(null);
    setErrorMessage(null);
    setActiveSession(null);
    setSessionSeconds(0);
  };

  const formatTimer = (totalSec) => {
    const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={activeSession ? () => {} : onClose}
      title="Turnstile Gate & Token Validator"
      subtitle="Verify customer booking pass code and control live access sessions"
      maxWidth="max-w-lg"
    >
      <div className="space-y-6">
        {/* Active Usage Session Tracker */}
        {activeSession && (
          <div className="bg-teal-900 text-white p-5 rounded-2xl shadow-xl text-center space-y-4 animate-fadeIn">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-800 text-teal-200 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Restroom Session Active
            </div>

            <div>
              <p className="text-3xl font-black font-mono tracking-wider">
                {formatTimer(sessionSeconds)}
              </p>
              <p className="text-xs text-teal-300 mt-1">
                Turnstile unlocked for Token: <strong>{tokenInput}</strong>
              </p>
            </div>

            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={handleEndSession}
              isLoading={isSessionActionLoading}
              leftIcon={Square}
              className="bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-lg"
            >
              End Usage Session & Lock Gate
            </Button>
          </div>
        )}

        {/* Token Input Form (When no active session is running) */}
        {!activeSession && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1">
              <Input
                label="Customer SG Booking Token"
                name="token"
                placeholder="SG-123456"
                value={tokenInput}
                onChange={handleTokenChange}
                leftIcon={QrCode}
                required
              />
              <p className="text-[11px] text-slate-400">
                Customer displays this token on their digital pass or mobile receipt.
              </p>
            </div>

            <Button
              variant="primary"
              type="submit"
              fullWidth
              isLoading={isVerifying}
              leftIcon={ShieldCheck}
            >
              Verify Access Pass
            </Button>
          </form>
        )}

        {/* Verification Error Box */}
        {errorMessage && !activeSession && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Token Ineligible or Invalid</span>
            </div>
            <p className="text-rose-700 leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Verification Success Box & Start Session Action */}
        {verificationResult && !activeSession && (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-emerald-900 text-sm">Pass Verified</span>
              </div>
              <Badge variant="success" size="sm">
                CONFIRMED
              </Badge>
            </div>

            <div className="space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Facility</span>
                <span className="font-bold text-slate-900">
                  {verificationResult.booking?.toilet?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scheduled Slot</span>
                <span className="font-medium text-slate-800">
                  {formatDateTime(verificationResult.booking?.startTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Verified</span>
                <span className="font-bold text-teal-800">
                  {formatCurrency(verificationResult.booking?.amount)} (PAID)
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={handleStartSession}
                isLoading={isSessionActionLoading}
                leftIcon={Play}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-glow"
              >
                Start Usage Session (Unlock Turnstile)
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!activeSession && (
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
            >
              Reset
            </button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
