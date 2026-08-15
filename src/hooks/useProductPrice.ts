import { useState, useEffect } from 'react';
import { DODO_API_BASE, DODO_PRODUCT_ID, DODO_READONLY_API_KEY } from '../config';

export function useProductPrice() {
  const [productPrice, setProductPrice] = useState<number | null>(null);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [productCurrency, setProductCurrency] = useState<string>('USD');
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${DODO_API_BASE}/products/${DODO_PRODUCT_ID}`, {
          headers: {
            'Authorization': `Bearer ${DODO_READONLY_API_KEY}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch product: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        if (data?.price?.price) {
          const original = data.price.price;
          const discountPercent = data.price.discount || 0;
          const finalCents = original * (1 - discountPercent / 100);

          setOriginalPrice(original / 100);
          setProductPrice(finalCents / 100);
          setProductCurrency(data.price.currency || 'USD');
        }
      } catch (e: any) {
        console.error('Failed to fetch product details', e);
        setError(e.message || 'Unknown error');
      } finally {
        setIsLoadingPrice(false);
      }
    };
    
    fetchProduct();
  }, []);

  return { productPrice, originalPrice, productCurrency, isLoadingPrice, error };
}
