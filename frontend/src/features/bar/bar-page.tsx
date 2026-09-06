import { Link } from 'react-router-dom';
import { PagePlaceholder } from '@/components/page-placeholder';

export function BarPage() {
  return (
    <div className="space-y-6">
      <PagePlaceholder
        eyebrow="Bar"
        title="Your shelves, at a glance."
        description="Have and Out inventory arrives in the next part of the MVP."
      />
      <Link
        to="/bar/ingredients"
        className="inline-block rounded-lg bg-primary px-5 py-3 text-primary-foreground"
      >
        Browse ingredients
      </Link>
    </div>
  );
}
