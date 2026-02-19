import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isLoggedIn() ? '/dashboard' : '/login');
  }, [router]);
  return null;
}
