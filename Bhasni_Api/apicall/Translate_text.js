// Desc: This file contains the function to translate the text from one language to another
  const getData =async (src,msg,target,srvId) => {

    return fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
        method: 'POST',
        headers:{
            'Content-Type': 'application/json',
            'Authorization':'sTDAW0anybv8208p1Orv-VtSWgGjBXl1qmJbNErLpFtPNdt4cMMzAl127bu7lhsO'
          },
        body: JSON.stringify({
            "inputData": {
                "input": [
                    {
                        "source": msg
                    }
                ]
            },
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": src,
                            "targetLanguage": target
                        },
                        "serviceId": srvId
                    }
                }
            ]
        })
      })
        .then((response) => response.json())
            .then((data) => {
                return data;
            });
      
  };

  module.exports = getData;