export interface CapturedPhoto {
  analysisDataUrl: string;
  analysisBase64: string;
  thumbnailDataUrl: string;
  mimeType: string;
}

export function captureVideoFrame(video: HTMLVideoElement): CapturedPhoto {
  const srcWidth = video.videoWidth || 1280;
  const srcHeight = video.videoHeight || 960;

  // High-detail image for Gemini vision recognition (max 1024px longest edge)
  const maxAnalysisDim = 1024;
  const analysisScale = Math.min(1, maxAnalysisDim / Math.max(srcWidth, srcHeight));
  const analysisW = Math.max(1, Math.round(srcWidth * analysisScale));
  const analysisH = Math.max(1, Math.round(srcHeight * analysisScale));

  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = analysisW;
  analysisCanvas.height = analysisH;
  const analysisCtx = analysisCanvas.getContext('2d');
  if (!analysisCtx) {
    throw new Error('Unable to initialize image canvas.');
  }
  analysisCtx.drawImage(video, 0, 0, analysisW, analysisH);
  const analysisDataUrl = analysisCanvas.toDataURL('image/jpeg', 0.86);
  const analysisBase64 = analysisDataUrl.replace(/^data:image\/jpeg;base64,/, '');

  // Compact thumbnail for Firestore / local history (max 360px longest edge, <= 140KB)
  const maxThumbDim = 360;
  const thumbScale = Math.min(1, maxThumbDim / Math.max(srcWidth, srcHeight));
  const thumbW = Math.max(1, Math.round(srcWidth * thumbScale));
  const thumbH = Math.max(1, Math.round(srcHeight * thumbScale));

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (!thumbCtx) {
    throw new Error('Unable to initialize thumbnail canvas.');
  }
  thumbCtx.drawImage(video, 0, 0, thumbW, thumbH);
  let thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
  if (thumbnailDataUrl.length > 160000) {
    thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.5);
  }

  return {
    analysisDataUrl,
    analysisBase64,
    thumbnailDataUrl,
    mimeType: 'image/jpeg',
  };
}
