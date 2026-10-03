'use server';

import { headers } from 'next/headers';

export async function sendAddToCartCAPI(payload: {
  eventId: string;
  productId: string;
  productName: string;
  value: number;
  currency: string;
}) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  
  // Best practice for CAPI is capturing the user's IP and User Agent
  const reqHeaders = await headers();
  const clientIp = reqHeaders.get('x-forwarded-for') || reqHeaders.get('remote-addr') || '';
  const userAgent = reqHeaders.get('user-agent') || '';

  const capiData = {
    data: [
      {
        event_name: 'AddToCart',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: payload.eventId, // This deduplicates the event
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: userAgent,
        },
        custom_data: {
          content_ids: [payload.productId],
          content_name: payload.productName,
          content_type: 'product',
          value: payload.value,
          currency: payload.currency,
        },
      },
    ],
  };

  try {
    await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiData),
    });
  } catch (error) {
    console.error('Meta CAPI Error:', error);
  }
}
export async function sendInitiateCheckoutCAPI(payload: {
    eventId: string;
    value: number;
    currency: string;
    cartItems: any[]; // Pass your cart items here
  }) {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;
    
    const reqHeaders = await headers();
    const clientIp = reqHeaders.get('x-forwarded-for') || reqHeaders.get('remote-addr') || '';
    const userAgent = reqHeaders.get('user-agent') || '';
  
    const contentIds = payload.cartItems.map(item => item.id);
  
    const capiData = {
      data: [{
        event_name: 'InitiateCheckout',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: payload.eventId,
        user_data: { client_ip_address: clientIp, client_user_agent: userAgent },
        custom_data: {
          content_ids: contentIds,
          content_type: 'product',
          value: payload.value,
          currency: payload.currency,
        },
      }],
    };
  
    try {
      await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiData),
      });
    } catch (error) {
      console.error('Meta CAPI Error:', error);
    }
  }
  export async function sendPageViewCAPI(payload: { eventId: string; url: string }) {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;
    
    const reqHeaders = await headers();
    const clientIp = reqHeaders.get('x-forwarded-for') || reqHeaders.get('remote-addr') || '';
    const userAgent = reqHeaders.get('user-agent') || '';
  
    const capiData = {
      data: [{
        event_name: 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: payload.eventId,
        event_source_url: payload.url,
        user_data: { client_ip_address: clientIp, client_user_agent: userAgent },
      }],
    };
  
    try {
      await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiData),
      });
    } catch (error) {
      console.error('Meta CAPI Error:', error);
    }
  }