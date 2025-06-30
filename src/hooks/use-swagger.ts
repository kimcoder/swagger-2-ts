import { GET_SWAGGER, GET_SWAGGER_FAILURE, GET_SWAGGER_SUCCESS } from '@/constants/messages';
import { SwaggerApi } from '@/types/swagger';
import { useEffect, useState } from 'react';

export const useSwagger = () => {
  const [apiList, setApiList] = useState<SwaggerApi[]>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    const sendMessage = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0]?.id ?? 1, { message: GET_SWAGGER }, (response) => {
          console.log(
            '[useSwagger] chrome.tabs.sendMessage call back',
            chrome.runtime.lastError,
            tabs,
            response,
          );
          if (chrome.runtime.lastError) {
            console.log('[useSwagger] chrome.tabs.sendMessage has LastError!!', response);
          }
        });
      });
    };
    console.log('sendMessage');
    sendMessage();
  }, []);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(
      ({ message, result, error }: { message: string; result: SwaggerApi[]; error: Error }) => {
        console.log('[useSwagger] chrome.runtime.onMessage', message, result);
        switch (message) {
          case GET_SWAGGER_SUCCESS:
            // result는 이미 처리된 API 목록 배열입니다
            setApiList(result);
            break;
          case GET_SWAGGER_FAILURE:
            setError(new Error(error?.message ?? 'ERROR!GET_SWAGGER_FAILURE'));
            break;
        }
      },
    );
  }, []);

  return {
    isLoading: !apiList && !error,
    apiList,
    error,
  };
};
