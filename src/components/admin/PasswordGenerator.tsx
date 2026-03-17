'use client'

import { useState, useCallback } from 'react'
import { Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react'

type PasswordGeneratorProps = {
  password: string
  confirmPassword: string
  onPasswordChange: (password: string) => void
  onConfirmChange: (confirm: string) => void
}

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*?'
  const all = upper + lower + digits + symbols

  // Ensure at least one of each category
  let pw = ''
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += lower[Math.floor(Math.random() * lower.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += symbols[Math.floor(Math.random() * symbols.length)]

  for (let i = pw.length; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)]
  }

  // Shuffle
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

function getStrength(pw: string): { label: string; percent: number; color: string } {
  if (!pw) return { label: '', percent: 0, color: 'bg-navy-200' }

  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z\d]/.test(pw)) score++

  if (score <= 1) return { label: 'Weak', percent: 20, color: 'bg-red-500' }
  if (score === 2) return { label: 'Fair', percent: 40, color: 'bg-gold-500' }
  if (score === 3) return { label: 'Good', percent: 60, color: 'bg-gold-400' }
  if (score === 4) return { label: 'Strong', percent: 80, color: 'bg-brand-500' }
  return { label: 'Very Strong', percent: 100, color: 'bg-emerald-500' }
}

export default function PasswordGenerator({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
}: PasswordGeneratorProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const strength = getStrength(password)
  const passwordsMatch = password && confirmPassword && password === confirmPassword

  const handleGenerate = useCallback(() => {
    const pw = generatePassword()
    onPasswordChange(pw)
    onConfirmChange(pw)
  }, [onPasswordChange, onConfirmChange])

  const handleCopy = useCallback(async () => {
    if (!password) return
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [password])

  return (
    <div className="space-y-5">
      {/* Password field */}
      <div className="animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <label className="block text-sm font-semibold text-navy-700 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="input-field pr-24"
            placeholder="Enter a strong password"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-navy-100/50 transition-all duration-200"
              title="Copy password"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-navy-400" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1.5 rounded-lg hover:bg-navy-100/50 transition-all duration-200"
              title={showPassword ? 'Hide' : 'Show'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-navy-400" />
              ) : (
                <Eye className="w-4 h-4 text-navy-400" />
              )}
            </button>
          </div>
        </div>

        {/* Strength meter */}
        {password && (
          <div className="mt-3 animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-navy-500">Password strength</span>
              <span className={`text-xs font-semibold ${
                strength.percent <= 40 ? 'text-red-500' :
                strength.percent <= 60 ? 'text-gold-600' :
                'text-brand-600'
              }`}>
                {strength.label}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-navy-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${strength.color} transition-all duration-500 ease-out`}
                style={{ width: `${strength.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <button
          type="button"
          onClick={handleGenerate}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Generate Strong Password
        </button>
      </div>

      {/* Confirm password */}
      <div className="animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
        <label className="block text-sm font-semibold text-navy-700 mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => onConfirmChange(e.target.value)}
            className={`input-field pr-10 ${
              confirmPassword
                ? passwordsMatch
                  ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-400/20'
                  : 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
                : ''
            }`}
            placeholder="Confirm your password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-navy-100/50 transition-all duration-200"
          >
            {showConfirm ? (
              <EyeOff className="w-4 h-4 text-navy-400" />
            ) : (
              <Eye className="w-4 h-4 text-navy-400" />
            )}
          </button>
        </div>
        {confirmPassword && !passwordsMatch && (
          <p className="mt-1.5 text-xs text-red-500 font-medium animate-fade-in">
            Passwords don&apos;t match
          </p>
        )}
        {passwordsMatch && (
          <p className="mt-1.5 text-xs text-emerald-600 font-medium animate-fade-in flex items-center gap-1">
            <Check className="w-3 h-3" />
            Passwords match
          </p>
        )}
      </div>
    </div>
  )
}
