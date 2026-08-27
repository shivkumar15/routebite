import mongoose from 'mongoose';
import {
  PARTNER_VERIFICATION_STATUS,
  UPLOAD_PURPOSE,
} from '../constants/partner.constants.js';
import { Partner } from '../models/partner.model.js';
import { UploadAsset } from '../models/upload-asset.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';
import { createAuthenticatedAssetUrl } from './upload.service.js';

function toSafePartner(partner) {
  return {
    id: partner._id.toString(),
    verificationStatus: partner.verificationStatus,
    availabilityStatus: partner.availabilityStatus,
    collegeName: partner.collegeIdentity.collegeName,
    enrollmentNumber: partner.collegeIdentity.enrollmentNumber,
    rejectionReason: partner.collegeIdentity.rejectionReason ?? null,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
}

export async function getPartnerCapabilityForUser(userId) {
  const partner = await Partner.findOne({ userId }).select(
    '_id verificationStatus availabilityStatus',
  );

  if (!partner) {
    return {
      exists: false,
      verificationStatus: null,
      availabilityStatus: null,
    };
  }

  return {
    exists: true,
    id: partner._id.toString(),
    verificationStatus: partner.verificationStatus,
    availabilityStatus: partner.availabilityStatus,
  };
}

async function assertApplicationAssets({ userId, profilePhotoAssetId, collegeIdAssetId }) {
  const ids = [profilePhotoAssetId, collegeIdAssetId];

  const assets = await UploadAsset.find({
    _id: { $in: ids },
    ownerUserId: userId,
  }).select('_id purpose');

  if (assets.length !== 2) {
    throw new AppError('One or more uploaded assets are invalid.', {
      statusCode: 422,
      code: 'INVALID_PARTNER_ASSET',
    });
  }

  const byId = new Map(assets.map((asset) => [asset._id.toString(), asset.purpose]));

  if (byId.get(profilePhotoAssetId) !== UPLOAD_PURPOSE.PROFILE_PHOTO) {
    throw new AppError('The profile photo asset is invalid.', {
      statusCode: 422,
      code: 'INVALID_PROFILE_PHOTO_ASSET',
    });
  }

  if (byId.get(collegeIdAssetId) !== UPLOAD_PURPOSE.COLLEGE_ID) {
    throw new AppError('The college ID asset is invalid.', {
      statusCode: 422,
      code: 'INVALID_COLLEGE_ID_ASSET',
    });
  }
}

export async function applyForPartner({ userId, payload }) {
  const existing = await Partner.findOne({ userId }).select('_id verificationStatus').lean();

  if (existing) {
    throw new AppError('A partner application already exists for this account.', {
      statusCode: 409,
      code: 'PARTNER_APPLICATION_EXISTS',
    });
  }

  await assertApplicationAssets({
    userId,
    profilePhotoAssetId: payload.profilePhotoAssetId,
    collegeIdAssetId: payload.collegeIdAssetId,
  });

  try {
    const partner = await Partner.create({
      userId,
      verificationStatus: PARTNER_VERIFICATION_STATUS.PENDING,
      profilePhotoAssetId: payload.profilePhotoAssetId,
      collegeIdentity: {
        enrollmentNumber: payload.enrollmentNumber.trim(),
        collegeName: payload.collegeName.trim(),
        documentAssetId: payload.collegeIdAssetId,
      },
    });

    return toSafePartner(partner);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('A partner application already exists for this account.', {
        statusCode: 409,
        code: 'PARTNER_APPLICATION_EXISTS',
      });
    }

    throw error;
  }
}

export async function getMyPartnerProfile(userId) {
  const partner = await Partner.findOne({ userId });

  if (!partner) {
    throw new AppError('Partner profile not found.', {
      statusCode: 404,
      code: 'PARTNER_PROFILE_NOT_FOUND',
    });
  }

  return toSafePartner(partner);
}

export async function listPendingPartners() {
  const partners = await Partner.find({
    verificationStatus: PARTNER_VERIFICATION_STATUS.PENDING,
  })
    .sort({ createdAt: 1 })
    .populate('userId', 'name email phone phoneVerified')
    .lean();

  const assetIds = partners.flatMap((partner) => [
    partner.profilePhotoAssetId,
    partner.collegeIdentity.documentAssetId,
  ]);

  const assets = await UploadAsset.find({ _id: { $in: assetIds } }).select('+publicId');
  const assetById = new Map(assets.map((asset) => [asset._id.toString(), asset]));

  return partners.map((partner) => {
    const profilePhoto = assetById.get(partner.profilePhotoAssetId.toString());
    const collegeId = assetById.get(partner.collegeIdentity.documentAssetId.toString());

    return {
      id: partner._id.toString(),
      verificationStatus: partner.verificationStatus,
      applicant: {
        id: partner.userId._id.toString(),
        name: partner.userId.name,
        email: partner.userId.email,
        phone: partner.userId.phone,
        phoneVerified: partner.userId.phoneVerified,
      },
      collegeName: partner.collegeIdentity.collegeName,
      enrollmentNumber: partner.collegeIdentity.enrollmentNumber,
      submittedAt: partner.createdAt,
      reviewAssets: {
        profilePhotoUrl: profilePhoto ? createAuthenticatedAssetUrl(profilePhoto) : null,
        collegeIdUrl: collegeId ? createAuthenticatedAssetUrl(collegeId) : null,
      },
    };
  });
}

export async function approvePartner({ partnerId, adminUserId }) {
  const partner = await Partner.findById(partnerId).populate('userId', 'phoneVerified');

  if (!partner) {
    throw new AppError('Partner application not found.', {
      statusCode: 404,
      code: 'PARTNER_APPLICATION_NOT_FOUND',
    });
  }

  if (!partner.userId.phoneVerified) {
    throw new AppError('The applicant must verify their phone before approval.', {
      statusCode: 422,
      code: 'PARTNER_PHONE_NOT_VERIFIED',
    });
  }

  const updated = await Partner.findOneAndUpdate(
    {
      _id: partnerId,
      verificationStatus: PARTNER_VERIFICATION_STATUS.PENDING,
    },
    {
      $set: {
        verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
        'collegeIdentity.reviewedAt': new Date(),
        'collegeIdentity.reviewedBy': new mongoose.Types.ObjectId(adminUserId),
        'collegeIdentity.rejectionReason': null,
      },
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new AppError('This partner application has already been reviewed.', {
      statusCode: 409,
      code: 'PARTNER_ALREADY_REVIEWED',
    });
  }

  return toSafePartner(updated);
}

export async function rejectPartner({ partnerId, adminUserId, reason }) {
  const updated = await Partner.findOneAndUpdate(
    {
      _id: partnerId,
      verificationStatus: PARTNER_VERIFICATION_STATUS.PENDING,
    },
    {
      $set: {
        verificationStatus: PARTNER_VERIFICATION_STATUS.REJECTED,
        'collegeIdentity.reviewedAt': new Date(),
        'collegeIdentity.reviewedBy': new mongoose.Types.ObjectId(adminUserId),
        'collegeIdentity.rejectionReason': reason.trim(),
      },
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    const exists = await Partner.exists({ _id: partnerId });
    throw new AppError(
      exists ? 'This partner application has already been reviewed.' : 'Partner application not found.',
      {
        statusCode: exists ? 409 : 404,
        code: exists ? 'PARTNER_ALREADY_REVIEWED' : 'PARTNER_APPLICATION_NOT_FOUND',
      },
    );
  }

  return toSafePartner(updated);
}
