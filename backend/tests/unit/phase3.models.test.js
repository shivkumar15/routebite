import mongoose from 'mongoose';
import { Partner } from '../../src/models/partner.model.js';
import { Trip } from '../../src/models/trip.model.js';

function objectId() {
  return new mongoose.Types.ObjectId();
}

describe('Phase 3 geospatial schemas', () => {
  test('partner accepts GeoJSON in longitude-latitude order', () => {
    const partner = new Partner({
      userId: objectId(),
      profilePhotoAssetId: objectId(),
      collegeIdentity: {
        enrollmentNumber: 'IIT2023001',
        collegeName: 'IIIT Allahabad',
        documentAssetId: objectId(),
      },
      currentLocation: {
        type: 'Point',
        coordinates: [81.77, 25.43],
      },
    });

    expect(partner.validateSync()).toBeUndefined();
    expect(partner.currentLocation.coordinates).toEqual([81.77, 25.43]);
  });

  test('partner rejects invalid GeoJSON latitude', () => {
    const partner = new Partner({
      userId: objectId(),
      profilePhotoAssetId: objectId(),
      collegeIdentity: {
        enrollmentNumber: 'IIT2023002',
        collegeName: 'IIIT Allahabad',
        documentAssetId: objectId(),
      },
      currentLocation: {
        type: 'Point',
        coordinates: [81.77, 125.43],
      },
    });

    expect(partner.validateSync()).toBeDefined();
  });

  test('trip schema has geospatial indexes and a one-active-trip unique index', () => {
    const indexes = Trip.schema.indexes();

    expect(indexes.some(([fields]) => fields.origin === '2dsphere')).toBe(true);
    expect(indexes.some(([fields]) => fields.destination === '2dsphere')).toBe(true);
    expect(
      indexes.some(
        ([fields, options]) =>
          fields.partnerId === 1 &&
          fields.status === 1 &&
          options.unique === true &&
          options.partialFilterExpression?.status === 'TRIP_ACTIVE',
      ),
    ).toBe(true);
  });
});
