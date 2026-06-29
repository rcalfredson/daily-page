import {
  isValidBannerImageUrl,
  isValidBannerStreetViewUrl,
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

  it('accepts only validated Google Maps embed URLs for Street View banners', () => {
    expect(isValidBannerStreetViewUrl(
      'https://www.google.com/maps/embed?pb=!4v123!6m8'
    )).toBeTrue();
    expect(isValidBannerStreetViewUrl(
      'https://www.google.com.evil.example/maps/embed?pb=!4v123!6m8'
    )).toBeFalse();
    expect(isValidBannerStreetViewUrl(
      'https://www.google.com/maps/search?pb=!4v123!6m8'
    )).toBeFalse();
  });

  it('trims valid metadata and omits an empty caption', () => {
    expect(normalizeBannerImageInput({
      url: ' https://images.example.com/banner.jpg ',
      caption: ' A useful caption '
    })).toEqual({
      value: {
        kind: 'image',
        url: 'https://images.example.com/banner.jpg',
        caption: 'A useful caption'
      },
      shouldUnset: false
    });

    expect(normalizeBannerImageInput({
      url: 'https://images.example.com/banner.jpg',
      caption: ' '
    }).value).toEqual({
      kind: 'image',
      url: 'https://images.example.com/banner.jpg'
    });
  });

  it('normalizes a Street View banner with an explicit kind', () => {
    expect(normalizeBannerImageInput({
      kind: 'streetview',
      url: ' https://www.google.com/maps/embed?pb=!4v123!6m8 ',
      caption: ' A highway panorama '
    })).toEqual({
      value: {
        kind: 'streetview',
        url: 'https://www.google.com/maps/embed?pb=!4v123!6m8',
        caption: 'A highway panorama'
      },
      shouldUnset: false
    });
  });

  it('rejects an invalid banner kind or mismatched URL', () => {
    expect(() => normalizeBannerImageInput({
      kind: 'video',
      url: 'https://example.com/banner.mp4'
    })).toThrowError(/kind must be image or streetview/);
    expect(() => normalizeBannerImageInput({
      kind: 'streetview',
      url: 'https://example.com/banner.jpg'
    })).toThrowError(/valid Google Maps embed URL/);
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
