import pug from 'pug';

describe('banner image view partial', () => {
  const renderBanner = (post, variant = 'hero', linkRoomId = null) => pug.render(`
include views/partials/_banner_image.pug
+blockBanner(post, variant, linkRoomId)
`, {
    filename: `${process.cwd()}/banner-image-spec.pug`,
    post,
    variant,
    linkRoomId
  });

  it('renders banner markup when a post has banner metadata', () => {
    const html = renderBanner({
      _id: 'post-id',
      title: 'Test post',
      bannerImage: {
        url: 'https://images.example.com/banner.jpg',
        caption: 'A descriptive caption'
      }
    });

    expect(html).toContain('class="block-banner block-banner--hero block-banner--image"');
    expect(html).toContain('src="https://images.example.com/banner.jpg"');
    expect(html).toContain('alt="A descriptive caption"');
    expect(html).toContain('<figcaption class="block-banner__caption">A descriptive caption</figcaption>');
  });

  it('renders nothing when banner metadata is absent', () => {
    expect(renderBanner({ _id: 'post-id', title: 'Test post' })).toBe('');
  });

  it('renders an interactive Street View iframe for a hero banner', () => {
    const html = renderBanner({
      _id: 'post-id',
      title: 'Street View post',
      bannerImage: {
        kind: 'streetview',
        url: 'https://www.google.com/maps/embed?pb=!4v123!6m8',
        caption: 'Highway panorama'
      }
    });

    expect(html).toContain('class="block-banner__street-view"');
    expect(html).toContain('src="https://www.google.com/maps/embed?pb=!4v123!6m8"');
    expect(html).toContain('title="Highway panorama"');
    expect(html).toContain('allowfullscreen="allowfullscreen"');
    expect(html).not.toContain('pointer-events');
  });

  it('renders a lazy Street View iframe behind the post link on cards', () => {
    const html = renderBanner({
      _id: 'post-id',
      title: 'Street View post',
      bannerImage: {
        kind: 'streetview',
        url: 'https://www.google.com/maps/embed?pb=!4v123!6m8'
      }
    }, 'card', 'general');

    expect(html).toContain('loading="lazy"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="block-banner__link block-banner__link--overlay"');
    expect(html).toContain('href="/rooms/general/blocks/post-id"');
    expect(html).not.toContain('allowfullscreen');
  });

  it('treats legacy banner metadata without a kind as an image', () => {
    const html = renderBanner({
      _id: 'post-id',
      title: 'Legacy banner post',
      bannerImage: { url: 'https://images.example.com/legacy.jpg' }
    });

    expect(html).toContain('<img');
    expect(html).not.toContain('<iframe');
  });
});
