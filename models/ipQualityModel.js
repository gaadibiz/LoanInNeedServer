const prisma = require('../utils/prismaClient');

const IpQualityModel = {
  /**
   * Find IP quality record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.ipQualityDetail.findUnique({
      where: { userId },
    });
  },

  /**
   * Upsert the full IP quality & risk score payload fetched from Signzy's
   * IP Quality Check API, storing the parsed attributes and the raw JSON response.
   */
  async saveIpQualityDetails(userId, { ipAddress, result, response }, tx = prisma) {
    const client = tx;
    const resObj = response || result || {};
    const resData = result || resObj?.result || resObj;

    const data = {
      ipAddress,
      fraudScore: resData?.fraudScore != null ? String(resData.fraudScore) : null,
      botStatus: resData?.botStatus != null ? String(resData.botStatus) : null,
      isCrawler: resData?.isCrawler != null ? String(resData.isCrawler) : null,
      proxy: resData?.proxy != null ? String(resData.proxy) : null,
      vpn: resData?.vpn != null ? String(resData.vpn) : null,
      tor: resData?.tor != null ? String(resData.tor) : null,
      recentAbuse: resData?.recentAbuse != null ? String(resData.recentAbuse) : null,
      mobile: resData?.mobile != null ? String(resData.mobile) : null,
      city: resData?.city || null,
      region: resData?.region || null,
      countryCode: resData?.countryCode || null,
      isp: resData?.isp || null,
      asn: resData?.asn || null,
      organization: resData?.organization || null,
      timezone: resData?.timezone || null,
      latitude: resData?.latitude != null ? String(resData.latitude) : null,
      longitude: resData?.longitude != null ? String(resData.longitude) : null,
      host: resData?.host || null,
      address: resData?.address || null,
      response: resObj,
      fetchedAt: new Date(),
    };

    return client.ipQualityDetail.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  /**
   * Delete IP quality record by userId
   */
  async deleteByUserId(userId, tx = prisma) {
    const client = tx;
    return client.ipQualityDetail.delete({
      where: { userId },
    });
  },
};

module.exports = IpQualityModel;
