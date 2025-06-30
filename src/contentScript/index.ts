import { GET_SWAGGER, GET_SWAGGER_FAILURE, GET_SWAGGER_SUCCESS } from '@/constants/messages';
import { getAPIList } from '@/contentScript/swagger-parser';

chrome.runtime.onMessage.addListener(({ message }) => {
  if (message === GET_SWAGGER) {
    getAPIList()
      .then((result) => {
        try {
          chrome.runtime.sendMessage({ message: GET_SWAGGER_SUCCESS, result }, (response) => {
            if (chrome.runtime.lastError) {
              // console.log('Message sending failed:', chrome.runtime.lastError.message);
              return;
            }
            // console.log('Message sent successfully', response);
          });
        } catch (error) {
          // console.error('Failed to send message:', error);
        }
      })
      .catch((err) => {
        try {
          chrome.runtime.sendMessage(
            {
              message: GET_SWAGGER_FAILURE,
              error: {
                message:
                  (err as Error)?.message ??
                  'Unable to parse Swagger documentation. Please verify that this page contains valid Swagger/OpenAPI documentation.',
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                // console.log('Error message sending failed:', chrome.runtime.lastError.message);
                return;
              }
              // console.log('Error message sent successfully', response);
            },
          );
        } catch (error) {
          // console.error('Failed to send error message:', error);
        }
      });
  }
  // Return true to indicate you want to send a response asynchronously
  return true;
});
