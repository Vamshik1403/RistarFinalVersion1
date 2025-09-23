import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AddressbookController } from './addressbook/addressbook.controller';
import { AddressbookModule } from './addressbook/addressbook.module';
import { AddressbookService } from './addressbook/addressbook.service';
import { PortsModule } from './ports/ports.module';
import { CurrencyModule } from './currency/currency.module';
import { CountryModule } from './country/country.module';
import { InventoryModule } from './inventory/inventory.module';
import { LeasingInfoModule } from './leasing-info/leasing-info.module';

import { OnHireReportModule } from './on-hire-report/on-hire-report.module';
import { TankCertificateModule } from './tank-certificate/tank-certificate.module';
import { ProductsModule } from './products/products.module';
import { ProductMsdsModule } from './product-msds/product-msds.module';
import { ContainerLeaseTariffModule } from './container-lease-tariff/container-lease-tariff.module';
import { HandlingAgentTariffCostModule } from './handling-agent-tariff-cost/handling-agent-tariff-cost.module';
import { LandTransportTariffModule } from './land-transport-tariff/land-transport-tariff.module';
import { DepotAvgTariffModule } from './depot-avg-tariff/depot-avg-tariff.module';
import { DepotCleaningTariffCostModule } from './depot-cleaning-tariff-cost/depot-cleaning-tariff-cost.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { QuotationModule } from './quotation/quotation.module';
import { ShipmentModule } from './shipment/shipment.module';
import { MovementHistoryModule } from './movement-history/movement-history.module';
import { EmptyRepoJobModule } from './empty-repo-job/empty-repo-job.module';
import { AuthModule } from './auth/auth.module';
import { PermissionsModule } from './permissions/permissions.module';
import { BillOfLadingModule } from './bill-of-lading/bill-of-lading.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuditController } from './audit/audit.controller';
import { AuditModule } from './audit/audit.module';
import { BillManagementModule } from './bill-management/bill-management.module';

@Module({
  imports: [ 
    ConfigModule.forRoot({ isGlobal: true }),
    AddressbookModule, 
    PrismaModule, 
    PortsModule, 
    CurrencyModule, 
    CountryModule, 
    InventoryModule, 
    LeasingInfoModule, 
    TankCertificateModule, 
    OnHireReportModule, 
    ProductsModule, 
    ProductMsdsModule, 
    ContainerLeaseTariffModule, 
    HandlingAgentTariffCostModule, 
    LandTransportTariffModule, 
    DepotAvgTariffModule,
    ExchangeRateModule, 
    DepotCleaningTariffCostModule, 
    QuotationModule,
    ShipmentModule,
    MovementHistoryModule,
    EmptyRepoJobModule,
    AuthModule,
    PermissionsModule,
    BillOfLadingModule,
    UserModule,
    AuditModule,
    BillManagementModule,

  ],

  controllers: [AppController, AddressbookController, AuditController],
  providers: [AppService, AddressbookService],
})
export class AppModule {}