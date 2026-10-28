import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { input } from '../lib/styles';
import { LotusMark } from './ui';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[20px] border border-line bg-surface shadow-card md:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden md:flex flex-col justify-between overflow-hidden bg-saffron-900 p-10 text-saffron-50">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-6 select-none font-script text-[11rem] leading-none text-white/[0.06]">
          ಸ್ವರ
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -left-6 bottom-16 select-none text-[8rem] leading-none text-white/[0.05]">
          स्वर
        </div>
        <LotusMark className="relative w-11 h-11" />
        <div className="relative">
          <p className="font-display text-[1.7rem] font-semibold leading-snug text-white">
            India has 197 endangered languages, more than any other country.
          </p>
          <p className="mt-3 text-sm text-saffron-100/80">UNESCO Atlas of the World's Languages in Danger</p>
          <ul className="mt-8 space-y-2.5 text-[15px] text-saffron-50/90">
            <li className="flex gap-2"><span className="text-saffron-300">●</span> Record songs, stories and conversations</li>
            <li className="flex gap-2"><span className="text-saffron-300">●</span> AI drafts the transcript; speakers correct it</li>
            <li className="flex gap-2"><span className="text-saffron-300">●</span> The archive keeps every voice for the future</li>
          </ul>
        </div>
      </aside>
      <div className="p-7 sm:p-10">
        <div className="md:hidden mb-6"><LotusMark className="w-10 h-10" /></div>
        <h1 className="text-[1.9rem] font-bold text-ink">{title}</h1>
        <p className="mt-1.5 mb-7 text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${input} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
      </button>
    </div>
  );
}
