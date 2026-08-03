import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

export const rtcService = {
  generateToken(channelName, userAccount) {
    const appId = process.env.AGORA_APP_ID || "mock-agora-app-id-123";
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || "mock-agora-cert-456";
    const isMockConfig = appId.startsWith("mock-") || appCertificate.startsWith("mock-");
    
    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = isMockConfig
      ? `mock-rtc-token-${channelName}-${userAccount}-${privilegeExpiredTs}`
      : RtcTokenBuilder.buildTokenWithAccount(
          appId,
          appCertificate,
          channelName,
          userAccount,
          RtcRole.PUBLISHER,
          privilegeExpiredTs,
          privilegeExpiredTs
        );
    
    return { token, channelName, uid: userAccount, appId };
  }
};
