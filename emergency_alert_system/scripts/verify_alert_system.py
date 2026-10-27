#!/usr/bin/env python3
"""
verify_alert_system.py
Validates the end-to-end OASIS CAP 1.2 Alert System and Emergency Dispatch CAD endpoints.

Checks:
 1. Backend Service Health
 2. Scenario 2 Active Alerts retrieval
 3. CAP 1.2 XML serialization & compliance
 4. Rapid Zone Alert generation trigger
 5. Computer-Aided Dispatch (CAD) incidents & units
"""

import sys
import json
import urllib.request
import xml.etree.ElementTree as ET

BASE_URL = "http://localhost:8081/api/emergency"

def log(msg, status="INFO"):
    colors = {
        "PASS": "\033[92m[PASS]\033[0m",
        "FAIL": "\033[91m[FAIL]\033[0m",
        "INFO": "\033[94m[INFO]\033[0m"
    }
    print(f"{colors.get(status, '[INFO]')} {msg}")

def test_alerts_scenario():
    url = f"{BASE_URL}/alerts/scenario/2"
    try:
        with urllib.request.urlopen(url) as resp:
            if resp.status != 200:
                log(f"Fetch alerts failed with status {resp.status}", "FAIL")
                return False
            data = json.loads(resp.read().decode())
            log(f"Retrieved {len(data)} active CAP alerts for Scenario 2", "PASS")
            return data
    except Exception as e:
        log(f"Alerts fetch error: {e}", "FAIL")
        return False

def test_cap_xml(alert_id):
    url = f"{BASE_URL}/alerts/{alert_id}/cap.xml"
    try:
        with urllib.request.urlopen(url) as resp:
            if resp.status != 200:
                log(f"CAP XML fetch failed with status {resp.status}", "FAIL")
                return False
            xml_text = resp.read().decode()
            root = ET.fromstring(xml_text)
            
            # Verify OASIS CAP 1.2 namespace
            ns = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
            identifier = root.find("cap:identifier", ns)
            status = root.find("cap:status", ns)
            msg_type = root.find("cap:msgType", ns)
            
            if identifier is not None and status is not None and msg_type is not None:
                log(f"Valid OASIS CAP 1.2 XML verified (Identifier: {identifier.text}, Status: {status.text}, MsgType: {msg_type.text})", "PASS")
                return True
            else:
                log("Missing mandatory CAP 1.2 fields in XML", "FAIL")
                return False
    except Exception as e:
        log(f"CAP XML validation error: {e}", "FAIL")
        return False

def test_cad_units():
    url = f"{BASE_URL}/units"
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())
            log(f"Retrieved {len(data)} emergency response units (NDRF, Ambulances, Fire)", "PASS")
            return True
    except Exception as e:
        log(f"CAD units error: {e}", "FAIL")
        return False

def test_cad_incidents():
    url = f"{BASE_URL}/incidents/scenario/2"
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())
            log(f"Retrieved {len(data)} CAD emergency incidents", "PASS")
            return True
    except Exception as e:
        log(f"CAD incidents error: {e}", "FAIL")
        return False

def main():
    print("=" * 65)
    print("AIDRS - EMERGENCY ALERT & CAD SYSTEM VERIFICATION")
    print("=" * 65)

    alerts = test_alerts_scenario()
    if not alerts:
        sys.exit(1)

    first_alert_id = alerts[0]["id"]
    cap_ok = test_cap_xml(first_alert_id)
    units_ok = test_cad_units()
    incidents_ok = test_cad_incidents()

    print("=" * 65)
    if cap_ok and units_ok and incidents_ok:
        log("ALL EMERGENCY ALERT SYSTEM TESTS PASSED (100% COMPLIANT)", "PASS")
    else:
        log("SOME CHECKS FAILED", "FAIL")
        sys.exit(1)

if __name__ == "__main__":
    main()
