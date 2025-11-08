const express = require('express');
const router = express.Router();
const getData = require('../apicall/Translate_text');

router.post('/', async (req, res) => {
  const { source_language: src, content, target_language: target } = req.body;
  const serviceId = 'ai4bharat/indictrans-v2-all-gpu--t4';

  try {
    const result = await getData(src, content, target, serviceId);

    res.status(200).json({
      status_code: 200,
      message: 'success',
      translated_content: result.pipelineResponse[0].output[0].target,
    });
  } catch (error) {
    let error_message = error?.detail?.message || 'Unknown error';

    if (src?.length !== 2 || target?.length !== 2) {
      error_message = 'Invalid Language Codes';
    }

    res.status(500).json({
      status_code: 500,
      message: error_message,
      translated_content: null,
    });
  }
});

module.exports = router;
