# API de Traitement de Données CSV

Cette API Scala permet de traiter automatiquement des fichiers CSV en effectuant plusieurs opérations de **nettoyage** et de **normalisation** des données.

---

## Fonctionnalités

- Traitement des valeurs manquantes :
  - Remplacement par la **moyenne** pour les colonnes numériques
  - Remplacement par le **mode** pour les colonnes catégorielles
- Détection et correction des **valeurs aberrantes** (méthode IQR)
- Suppression des **doublons**
- **Normalisation** des données numériques (échelle 0-1)
- **Statistiques détaillées** sur le traitement effectué

---

## Prérequis

1. Java Development Kit (JDK) 8 ou supérieur  
2. [sbt (Scala Build Tool)](https://www.scala-sbt.org/)

### Installation de Java

1. Téléchargez et installez le JDK depuis le site officiel d’Oracle  
2. Vérifiez l’installation avec la commande :

```bash
java -version
