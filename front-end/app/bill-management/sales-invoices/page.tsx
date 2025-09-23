import React from 'react';
import SalesInvoicesPage from './SalesInvoice';
import SidebarWithHeader from '../../components/Sidebar';

export default function Customers() {
  return (
    <SidebarWithHeader>
      <SalesInvoicesPage />
    </SidebarWithHeader>
  );
}