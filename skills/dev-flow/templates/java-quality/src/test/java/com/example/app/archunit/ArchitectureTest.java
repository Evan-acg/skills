package com.example.app.archunit;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.Architectures;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;

@AnalyzeClasses(
    packages = "com.example.app",
    importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

  @ArchTest
  static final ArchRule layers = Architectures.layeredArchitecture()
      .consideringAllDependencies()
      .layer("Interfaces").definedBy("..interfaces..")
      .layer("Application").definedBy("..application..")
      .layer("Domain").definedBy("..domain..")
      .layer("Infrastructure").definedBy("..infrastructure..")
      .whereLayer("Interfaces").mayNotBeAccessedByAnyLayer()
      .whereLayer("Application").mayOnlyBeAccessedByLayers("Interfaces")
      .whereLayer("Domain").mayOnlyBeAccessedByLayers(
          "Interfaces", "Application", "Infrastructure")
      .whereLayer("Infrastructure").mayNotBeAccessedByAnyLayer();

  @ArchTest
  static final ArchRule domain_application_are_framework_free =
      ArchRuleDefinition.noClasses()
          .that().resideInAnyPackage("..application..", "..domain..")
          .should().dependOnClassesThat()
          .resideInAnyPackage(
              "org.springframework..",
              "javax.persistence..",
              "jakarta.persistence..");

  @ArchTest
  static final ArchRule no_cycles =
      ArchRuleDefinition.slices()
          .matching("com.example.app.(*)..")
          .should().beFreeOfCycles();
}
