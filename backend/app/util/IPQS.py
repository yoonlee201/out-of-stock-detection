
import json
from unittest import result
import requests
from app.core.config import config

# You may need to install Requests pip
# python -m pip install requests

class IPQS:
    key =  config.IPQS_API_KEY
    def phone_number_api(self, phonenumber: str, vars: dict = {}) -> dict:
        url = 'https://www.ipqualityscore.com/api/json/phone/%s/%s' %(self.key, phonenumber)
        x = requests.get(url, params = vars)
        return (json.loads(x.text))
countries = {'US', 'CA'}
additional_params = {
    'country' : countries
}

def get_phone_info(phone):
    """
    User & Transaction Scoring
    
    Score additional information from a user, order, or transaction for risk analysis
    Please see the documentation and example code to include this feature in your scoring:
    https://www.ipqualityscore.com/documentation/phone-number-validation-api/transaction-scoring
    This feature requires a Premium plan or greater
    """
    ipqs = IPQS()
    result  = ipqs.phone_number_api(phone, additional_params)

    # Check to see if our query was successful.
    if 'success' in result and result['success']:
        if result['valid']:
            return result
        """
        - Example 1: We'd like to block all invalid phone numbers and send them to Google.
         
        if $result['valid'] == False:
        	print('This is not a valid number');
        }
        """
        
        """
        - Example 2: We'd like to block all invalid or abusive phone numbers.
        
        if $result['valid'] == False or $result['recent_abuse'] == True:
        	print('This is not a valid number or is abusive');
        }
        """
        
        """
        If you are confused with these examples or simply have a use case
        not covered here, please feel free to contact IPQualityScore's support
        team. We'll craft a custom piece of code to meet your requirements.
        """
def get_user_carrier(phone):
    """
    Carrier Lookup
    
    Look up a phone number's carrier using the free NumVerify API.
    Returns a lowercase carrier name string, or None if lookup fails.
    """
    result = get_phone_info(phone)
    if 'valid' in result and result['valid'] and 'carrier' in result:
        return result['carrier'].lower()
    else:
        return None