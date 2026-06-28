import {
  isValidBannerImageUrl,
  normalizeBannerImageInput
} from '../server/db/bannerImage.js';

describe('banner image metadata', () => {
  it('accepts externally hosted http and https images', () => {
    expect(isValidBannerImageUrl('https://images.example.com/banner.jpg')).toBeTrue();
    expect(isValidBannerImageUrl('http://images.example.com/banner.jpg')).toBeTrue();
  });

  it('rejects non-web and malformed URLs', () => {
    expect(isValidBannerImageUrl('javascript:alert(1)')).toBeFalse();
    expect(isValidBannerImageUrl('/local/image.jpg')).toBeFalse();
    expect(isValidBannerImageUrl('not a URL')).toBeFalse();
  });

  it('trims valid metadata and omits an empty caption', () => {
    expect(normalizeBannerImageInput({
      url: ' https://images.example.com/banner.jpg ',
      caption: ' A useful caption '
    })).toEqual({
      value: {
        url: 'https://images.example.com/banner.jpg',
        caption: 'A useful caption'
      },
      shouldUnset: false
    });

    expect(normalizeBannerImageInput({
      url: 'https://images.example.com/banner.jpg',
      caption: ' '
    }).value).toEqual({ url: 'https://images.example.com/banner.jpg' });
  });

  it('uses an empty URL as an explicit removal', () => {
    expect(normalizeBannerImageInput({ url: '', caption: 'unused' })).toEqual({
      value: undefined,
      shouldUnset: true
    });
  });

  it('rejects overlong captions', () => {
    expect(() => normalizeBannerImageInput({
      url: 'https://images.example.com/banner.jpg',
      caption: 'x'.repeat(301)
    })).toThrowError(/cannot exceed 300 characters/);
  });
});
