import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DemoBanner } from '@/ui/Misc';
import { Spinner } from '@/ui/States';
import { DemoPanel } from '@/components/DemoPanel';
import { isEmbedded } from '@/lib/useEmbed';
import { Landing } from '@/apps/landing/Landing';

const ParentApp = lazy(() => import('@/apps/parent/ParentApp'));
const PosApp = lazy(() => import('@/apps/pos/PosApp'));
const SchoolApp = lazy(() => import('@/apps/school/SchoolApp'));
const SplitView = lazy(() => import('@/apps/demo/SplitView'));

function Fallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-brand-700">
      <Spinner className="size-8" />
    </div>
  );
}

export function App() {
  const embedded = isEmbedded();
  const { pathname } = useLocation();
  const isSplit = pathname.startsWith('/demo');

  return (
    <div className="flex min-h-dvh flex-col">
      {!embedded && <DemoBanner />}
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/parent/*" element={<ParentApp />} />
          <Route path="/pos" element={<PosApp />} />
          <Route path="/school/*" element={<SchoolApp />} />
          <Route path="/demo" element={<SplitView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!embedded && !isSplit && <DemoPanel />}
    </div>
  );
}
