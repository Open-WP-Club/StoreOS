import { useEffect, useState } from 'react';
import useStoreConfig from '../stores/storeConfigStore';
import { getStoreLogo } from '../utils/storeLogo';
import appIcon from '../../assets/icon.svg';

/** Current store's site logo/icon, falling back to the app icon. */
function StoreLogo({ className }: { className?: string }): React.ReactElement {
  const storeId = useStoreConfig((s) => s.currentStoreId);
  const storeUrl = useStoreConfig((s) => s.getCurrentStore()?.url);
  const [logo, setLogo] = useState<{ key: string; src: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${storeId}|${storeUrl}`;

  useEffect(() => {
    if (!storeId || !storeUrl) return;
    let cancelled = false;
    getStoreLogo(storeId, storeUrl).then((src) => {
      if (!cancelled) setLogo({ key: `${storeId}|${storeUrl}`, src });
    });
    return () => {
      cancelled = true;
    };
  }, [storeId, storeUrl]);

  const src = logo?.key === key && failed !== logo.src ? logo.src : null;
  return (
    <img
      src={src ?? appIcon}
      alt=""
      aria-hidden="true"
      className={className}
      referrerPolicy="no-referrer"
      onError={() => src && setFailed(src)}
    />
  );
}

export default StoreLogo;
