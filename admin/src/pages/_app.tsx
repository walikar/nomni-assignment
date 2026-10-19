import type { AppProps } from 'next/app';
import Head from 'next/head';
import Layout from '../components/Layout';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Kitchen Orders</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Uber Eats and DoorDash orders as one kitchen ticket" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}
