import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class WooCommerceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = new ec2.Vpc(this, 'ThreeTierAppVPC', {
      maxAzs: 2
    });

    // Create RDS database
    const database = new rds.DatabaseInstance(this, 'ThreeTierAppDB', {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      vpc
    });

    // Create Backend EC2 instances
    const backendASG = new autoscaling.AutoScalingGroup(this, 'ThreeTierAppBackendASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      minCapacity: 2,
      maxCapacity: 4
    });
    backendASG.scaleOnCpuUtilization('CPUScaling', { targetUtilizationPercent: 50 });

    // Create Frontend EC2 instances
    const frontendASG = new autoscaling.AutoScalingGroup(this, 'ThreeTierAppFrontendASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      minCapacity: 2,
      maxCapacity: 4
    });
    frontendASG.scaleOnCpuUtilization('CPUScaling', { targetUtilizationPercent: 50 });

    // Create Load Balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'ThreeTierAppLB', {
      vpc,
      internetFacing: true
    });

    // Add Target Groups and listeners
    const backendTG = new elbv2.ApplicationTargetGroup(this, 'BackendTargetGroup', {
      vpc,
      port: 80,
      targets: [backendASG]
    });

    const frontendTG = new elbv2.ApplicationTargetGroup(this, 'FrontendTargetGroup', {
      vpc,
      port: 80,
      targets: [frontendASG]
    });

    lb.addListener('FrontendListener', { port: 80, defaultTargetGroups: [frontendTG] });
    lb.addListener('BackendListener', { port: 8080, defaultTargetGroups: [backendTG] });

    // Output Load Balancer URL
    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: lb.loadBalancerDnsName });
  }
}
const app = new cdk.App();
new WooCommerceStack(app, 'WooCommerceStack');
