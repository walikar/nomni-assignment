import { PROVIDER_LABELS } from '../constants';
import { Provider } from '../types';

const PROVIDER_COLORS: Record<Provider, string> = {
  uber_eats: 'bg-uber-bg text-uber',
  doordash: 'bg-doordash-bg text-doordash',
};

interface ProviderBadgeProps {
  provider: Provider;
}

export default function ProviderBadge({ provider }: ProviderBadgeProps) {
  return (
    <span className={`inline-block text-[0.8rem] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${PROVIDER_COLORS[provider]}`}>
      {PROVIDER_LABELS[provider]}
    </span>
  );
}
