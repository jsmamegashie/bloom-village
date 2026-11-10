import { handleUpload } from '@vercel/blob/client';
import { checkPass } from './_auth.js';
export default async function handler(req, res) {
  try {
    const out = await handleUpload({
      body: req.body, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!(await checkPass(clientPayload))) throw new Error('bad passcode');
        return { addRandomSuffix: true, maximumSizeInBytes: 25 * 1024 * 1024 };
      },
      onUploadCompleted: async () => { }
    });
    res.status(200).json(out);
  } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
}
