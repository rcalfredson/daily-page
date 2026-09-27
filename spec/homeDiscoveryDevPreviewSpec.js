import fs from 'node:fs';

import { homeDiscoveryPreviewPosts } from '../server/routes/devViews.js';

describe('home discovery development preview', () => {
  it('provides a stable full shelf covering its important media and layout states', () => {
    const posts = homeDiscoveryPreviewPosts();

    expect(posts).toHaveSize(6);
    expect(posts.filter(post => post.bannerImage?.kind === 'streetview').length).toBe(3);
    expect(posts.some(post => post.bannerImage?.kind === 'image')).toBeTrue();
    expect(posts.some(post => !post.bannerImage)).toBeTrue();
    expect(posts.some(post => post.lang === 'ar')).toBeTrue();
  });

  it('registers and documents the non-production preview', () => {
    const routes = fs.readFileSync('server/routes/devViews.js', 'utf8');
    const view = fs.readFileSync('views/dev/home-discovery.pug', 'utf8');
    const readme = fs.readFileSync('README.md', 'utf8');

    expect(routes).toContain("'/__dev/views/home-discovery'");
    expect(view).toContain('include ../partials/_home_discovery_shelf');
    expect(readme).toContain('/en/__dev/views/home-discovery');
  });
});
