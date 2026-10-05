'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ProductCard, type ShopProduct } from '@/components/commerce';
import { ArrowUpRight } from 'lucide-react';

export function ProductsBrowser({ catalog }: { catalog: ShopProduct[] }) {
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');
  const shown = useMemo(() => {
    const filtered = category === 'All' ? [...catalog] : catalog.filter((product) => product.category === category);
    if (sort === 'low') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'high') filtered.sort((a, b) => b.price - a.price);
    if (sort === 'name') filtered.sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [catalog, category, sort]);

  return (
    <section className="shop-section shell section-pad">
      <div className="filters">
        <div role="group" aria-label="Filter products by category">{['All', 'Alarms', 'Tools'].map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}<sup>{item === 'All' ? catalog.length : catalog.filter((product) => product.category === item).length}</sup></button>)}</div>
        <label>Sort <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name</option></select></label>
      </div>
      <div className="product-grid">{shown.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </section>
  );
}

export function ShopNote() {
  return (
    <section className="shop-note shell">
      <p>Still deciding?</p>
      <h2>Buy the one you’ll keep on you.</h2>
      <span>The best safety tool is the boring one that’s already in your hand when you need it — not the impressive one in a drawer. If that’s the whistle, buy the whistle.<Link href="/#chooser" className="shop-note-link icon-link">Compare all four <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" /></Link></span>
    </section>
  );
}
