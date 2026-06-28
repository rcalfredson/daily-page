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

    expect(html).toContain('class="block-banner block-banner--hero"');
    expect(html).toContain('src="https://images.example.com/banner.jpg"');
    expect(html).toContain('alt="A descriptive caption"');
    expect(html).toContain('<figcaption class="block-banner__caption">A descriptive caption</figcaption>');
  });

  it('renders nothing when banner metadata is absent', () => {
    expect(renderBanner({ _id: 'post-id', title: 'Test post' })).toBe('');
  });
});
