import { Router } from 'express';
import { config } from '../config';
import { getProfileOverview, getReferralCode } from '../db';

const router = Router();

/**
 * Account profile and workshop activity for the signed-in user.
 *
 * The referral code is deterministic and contains no account information; it
 * is only a shareable tag. Stats and recent activity are read from the same
 * account-scoped vehicles/history tables as every other route.
 */
router.get('/', async (req, res) => {
  const user = req.user!;
  const overview = await getProfileOverview(user.id, 8);
  const referralCode = getReferralCode(user.id);
  const origin = config.publicAppUrl || `${req.protocol}://${req.get('host')}`;
  const referralUrl = `${origin}/app?ref=${encodeURIComponent(referralCode)}`;

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    profile: {
      user,
      status: overview.status,
      stats: overview.stats,
      latestActivity: overview.latestActivity,
      recentActivity: overview.recentActivity,
      referral: {
        code: referralCode,
        url: referralUrl,
      },
      storage: config.databaseProvider,
    },
  });
});

export default router;
